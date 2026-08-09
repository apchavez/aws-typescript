import type { CloudFormationCustomResourceEvent } from "aws-lambda";

const sendCfnResponseMock = jest.fn();
jest.mock("../src/infra/cfn-response", () => ({
  sendCfnResponse: (...args: unknown[]) => sendCfnResponseMock(...args),
}));

jest.mock("mysql2/promise", () => ({
  createConnection: jest.fn(),
}));

import mysql from "mysql2/promise";
import { handler } from "../src/infra/db-init";

const createConnectionMock = mysql.createConnection as unknown as jest.Mock;

function makeEvent(
  requestType: "Create" | "Delete",
  props: Record<string, unknown> = {}
): CloudFormationCustomResourceEvent {
  return {
    RequestType: requestType,
    ResponseURL: "https://example.com/cb",
    StackId: "stack-1",
    RequestId: "req-1",
    LogicalResourceId: "DbInit",
    ResourceType: "Custom::DbInit",
    ServiceToken: "arn:aws:lambda:us-east-1:111111111111:function:db-init",
    ResourceProperties: {
      ServiceToken: "arn:aws:lambda:us-east-1:111111111111:function:db-init",
      Host: "rds-host",
      Db: "appointments",
      User: "admin",
      Password: "s3cret",
      ...props,
    },
  } as unknown as CloudFormationCustomResourceEvent;
}

function makeConnStub() {
  return { execute: jest.fn().mockResolvedValue([{}]), end: jest.fn().mockResolvedValue(undefined) };
}

describe("db-init handler", () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    sendCfnResponseMock.mockReset();
    sendCfnResponseMock.mockResolvedValue(undefined);
    createConnectionMock.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    // Skip the real retry delay so exhausting retries doesn't slow the suite down.
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Delete request -> SUCCESS with skipped=true, no DB calls", async () => {
    await handler(makeEvent("Delete"));

    expect(sendCfnResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      "SUCCESS",
      "DbInit-v1",
      { skipped: true }
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("missing password -> FAILED and rethrows without attempting DB connections", async () => {
    await expect(
      handler(makeEvent("Create", { Password: "" }))
    ).rejects.toThrow("RDS password not provided");

    expect(sendCfnResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      "FAILED",
      "DbInit-v1",
      { error: "RDS password not provided" }
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("success path -> initializes the database and reports SUCCESS", async () => {
    const conn = makeConnStub();
    createConnectionMock.mockResolvedValueOnce(conn);

    await handler(makeEvent("Create"));

    expect(createConnectionMock).toHaveBeenCalledTimes(1);
    expect(createConnectionMock.mock.calls[0][0]).toMatchObject({
      host: "rds-host",
      database: "appointments",
      user: "admin",
      password: "s3cret",
    });
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS appointments")
    );
    expect(conn.end).toHaveBeenCalledTimes(1);

    expect(sendCfnResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      "SUCCESS",
      "DbInit-v1",
      { ok: true }
    );
  });

  test("retries the connection after a transient failure before succeeding", async () => {
    const conn = makeConnStub();
    createConnectionMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue(conn);

    await handler(makeEvent("Create"));

    expect(createConnectionMock).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(sendCfnResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      "SUCCESS",
      "DbInit-v1",
      { ok: true }
    );
  });

  test("exhausts all retry attempts -> FAILED with the connection error and rethrows", async () => {
    createConnectionMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(handler(makeEvent("Create"))).rejects.toThrow(
      "ECONNREFUSED"
    );

    expect(createConnectionMock).toHaveBeenCalledTimes(30);
    expect(sendCfnResponseMock).toHaveBeenCalledWith(
      expect.anything(),
      "FAILED",
      "DbInit-v1",
      { error: "ECONNREFUSED" }
    );
  }, 20000);
});
