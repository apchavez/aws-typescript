import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import crypto from "crypto";
import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import { sendCfnResponse } from "./cfn-response";
import { logger } from "../shared/logger";

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<void> => {
  const props = event.ResourceProperties as Record<string, string>;
  const name =
    props?.PasswordParamName ?? props?.SsmName ?? "/appointments/rds/password";
  const physicalId = `secrets-init:${name}`;
  logger.info("secrets-init invoked", { requestType: event.RequestType, name });
  const ssm = new SSMClient({});
  try {
    if (event.RequestType === "Delete") {
      await sendCfnResponse(event, "SUCCESS", physicalId, { skipped: true });
      return;
    }
    try {
      const existing = await ssm.send(
        new GetParameterCommand({ Name: name, WithDecryption: true })
      );
      await sendCfnResponse(event, "SUCCESS", physicalId, {
        exists: true,
        value: existing.Parameter?.Value,
      });
    } catch {
      const pwd = crypto.randomBytes(24).toString("base64url");
      await ssm.send(
        new PutParameterCommand({
          Name: name,
          Type: "SecureString",
          KeyId: "alias/aws/ssm",
          Value: pwd,
          Overwrite: true,
        })
      );
      logger.info("secrets-init: generated new SSM parameter", { name });
      await sendCfnResponse(event, "SUCCESS", physicalId, {
        created: true,
        value: pwd,
      });
    }
  } catch (err: unknown) {
    logger.error("secrets-init failed", { name, error: err instanceof Error ? err.message : String(err) });
    await sendCfnResponse(event, "FAILED", physicalId, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};
