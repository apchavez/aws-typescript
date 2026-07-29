const mockProcess = jest.fn();

jest.mock("../src/index", () => ({
  __esModule: true,
  appointmentMakeService: () => ({}),
  appointmentCountryMakeService: () => ({ process: mockProcess }),
}));

import type { SQSEvent, Context } from "aws-lambda";
import { handler } from "../src/api/lambda/appointment_country";

const ctx = {} as Context;
const cb = jest.fn();

const appointment = {
  appointmentUuid: "u1",
  insuredId: "01234",
  scheduleId: 100,
  status: "pending" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function sqsEvent(body: object): SQSEvent {
  return {
    Records: [
      {
        messageId: "msg-1",
        receiptHandle: "receipt-1",
        body: JSON.stringify(body),
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "1626387030000",
          SenderId: "AROAI3KMYGUXI3D5ABCDE:lambda",
          ApproximateFirstReceiveTimestamp: "1626387030001",
        },
        messageAttributes: {},
        md5OfBody: "md5",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:111111111111:test",
        awsRegion: "us-east-1",
      },
    ],
  };
}

describe("appointment_country handler", () => {
  beforeEach(() => {
    mockProcess.mockReset();
    cb.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("handler -> calls svc.process for an appointment payload", async () => {
    mockProcess.mockResolvedValue(undefined);

    await handler(sqsEvent(appointment), ctx, cb);

    expect(mockProcess).toHaveBeenCalledTimes(1);
    expect(mockProcess).toHaveBeenCalledWith(appointment);
  });

  test("handler -> unwraps SNS envelope when Message field is present", async () => {
    mockProcess.mockResolvedValue(undefined);

    await handler(sqsEvent({ Message: JSON.stringify(appointment) }), ctx, cb);

    expect(mockProcess).toHaveBeenCalledWith(appointment);
  });

  test("handler -> re-throws on service failure", async () => {
    mockProcess.mockRejectedValue(new Error("MySQL connection failed"));

    await expect(handler(sqsEvent(appointment), ctx, cb)).rejects.toThrow(
      "MySQL connection failed"
    );
  });
});
