import type { SQSHandler } from "aws-lambda";
import type { Appointment } from "../../domain/entities/Appointment";
import { appointmentCountryMakeService } from "../../index";
import { logger } from "../../shared/logger";

const svc = appointmentCountryMakeService();

export const handler: SQSHandler = async (event) => {
  logger.info("appointment_country handler invoked", { recordCount: event.Records.length });
  for (const record of event.Records) {
    try {
      const raw = JSON.parse(record.body) as Record<string, unknown>;
      const payload = (raw.Message
        ? JSON.parse(raw.Message as string)
        : raw) as Appointment;
      await svc.process(payload);
    } catch (err) {
      logger.error("Failed to process country booking record", {
        messageId: record.messageId,
        error: String(err),
      });
      throw err;
    }
  }
};
