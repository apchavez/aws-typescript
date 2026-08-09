import { mockClient } from "aws-sdk-client-mock";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

process.env.SES_SENDER_ADDRESS = "no-reply@example.com";

import { SesAppointmentNotifier } from "../src/infra/notifications/SesAppointmentNotifier";
import { NoOpAppointmentNotifier } from "../src/infra/notifications/NoOpAppointmentNotifier";
import type { Appointment } from "../src/domain/entities/Appointment";

const sesMock = mockClient(SESv2Client);

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    appointmentUuid: "u1",
    insuredId: "01234",
    scheduleId: 100,
    status: "pending",
    createdAt: "t",
    updatedAt: "t",
    ...overrides,
  };
}

describe("SesAppointmentNotifier (unit)", () => {
  let notifier: SesAppointmentNotifier;

  beforeEach(() => {
    sesMock.reset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    notifier = new SesAppointmentNotifier();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("notifyCompleted -> sends an email when contactEmail is set", async () => {
    sesMock.on(SendEmailCommand).resolves({});
    await notifier.notifyCompleted(makeAppointment({ contactEmail: "insured@example.com" }));

    const input = sesMock.commandCalls(SendEmailCommand)[0].args[0].input;
    expect(input.FromEmailAddress).toBe("no-reply@example.com");
    expect(input.Destination?.ToAddresses).toEqual(["insured@example.com"]);
    expect(input.Content?.Simple?.Subject?.Data).toMatch(/confirmed/);
  });

  test("notifyCompleted -> skips silently when contactEmail is absent", async () => {
    sesMock.on(SendEmailCommand).resolves({});
    await notifier.notifyCompleted(makeAppointment({ contactEmail: undefined }));
    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
  });

  test("send failures are swallowed (best-effort) and never thrown", async () => {
    sesMock.on(SendEmailCommand).rejects(new Error("SES unavailable"));
    await expect(
      notifier.notifyCompleted(makeAppointment({ contactEmail: "insured@example.com" }))
    ).resolves.toBeUndefined();
  });
});

describe("NoOpAppointmentNotifier (unit)", () => {
  test("all methods resolve without doing anything", async () => {
    const notifier = new NoOpAppointmentNotifier();
    await expect(notifier.notifyCompleted(makeAppointment())).resolves.toBeUndefined();
  });
});
