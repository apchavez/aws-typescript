import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AppointmentEvent } from "../../domain/entities/AppointmentEvent";
import type { IAppointmentEventStore } from "../../domain/ports/IAppointmentEventStore";
import { ddb } from "../config/ddb";
import { logger } from "../../shared/logger";

const TableName = process.env.TABLE_APPOINTMENT_EVENTS!;

export class DynamoAppointmentEventStore implements IAppointmentEventStore {
  async append(event: AppointmentEvent): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName,
        Item: { ...event, sortKey: `${event.occurredAt}#${event.eventId}` },
      })
    );
    logger.info("event store: appended", {
      eventId: event.eventId,
      appointmentUuid: event.appointmentUuid,
      eventType: event.eventType,
    });
  }

  async findByAppointmentId(appointmentUuid: string): Promise<AppointmentEvent[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: "appointmentUuid = :a",
        ExpressionAttributeValues: { ":a": appointmentUuid },
        ScanIndexForward: true,
      })
    );
    return (res.Items ?? []).map((item) => ({
      eventId: item.eventId,
      appointmentUuid: item.appointmentUuid,
      eventType: item.eventType,
      insuredId: item.insuredId,
      scheduleId: item.scheduleId,
      status: item.status,
      occurredAt: item.occurredAt,
    }));
  }
}
