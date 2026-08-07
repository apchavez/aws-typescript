import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import type { IConfirmationBus } from "../../domain/ports/IConfirmationBus";
import { captureAWSClient } from "../tracing";
import { withResilience } from "../../shared/resilience";
import { logger } from "../../shared/logger";

const EVENT_SOURCE = "appointment-service";

export class EventBridgeConfirmationBus implements IConfirmationBus {
  private readonly eb = captureAWSClient(new EventBridgeClient({}));
  private readonly eventBusName = process.env.EB_BUS_NAME!;
  private readonly resilient = withResilience("eventbridge-publish");

  async send(appointmentUuid: string): Promise<void> {
    await this.resilient(() =>
      this.eb.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: EVENT_SOURCE,
              DetailType: "AppointmentConfirmed",
              Detail: JSON.stringify({ appointmentUuid }),
              EventBusName: this.eventBusName,
            },
          ],
        })
      )
    );
    logger.info("eventbridge publish", { appointmentUuid, eventBusName: this.eventBusName });
  }
}
