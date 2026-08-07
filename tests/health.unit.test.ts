import { mockClient } from "aws-sdk-client-mock";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

process.env.TABLE_APPOINTMENT_EVENTS = "AppointmentEvents";

import { handler } from "../src/api/lambda/health";

const ddbMock = mockClient(DynamoDBClient);

describe("health handler (unit)", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  test("returns 200 UP when DynamoDB describe succeeds", async () => {
    ddbMock.on(DescribeTableCommand).resolves({});

    const res = await handler();

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("UP");
    expect(body.checks.dynamoDb).toBe("UP");
    expect(typeof body.timestamp).toBe("string");
  });

  test("returns 503 DOWN when DynamoDB describe fails", async () => {
    ddbMock.on(DescribeTableCommand).rejects(new Error("table not reachable"));

    const res = await handler();

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("DOWN");
    expect(body.checks.dynamoDb).toBe("DOWN");
  });
});
