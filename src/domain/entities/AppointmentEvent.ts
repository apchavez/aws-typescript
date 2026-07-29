import { randomUUID } from "crypto";
import type { Appointment } from "./Appointment";

export interface AppointmentEvent {
  eventId: string;
  appointmentUuid: string;
  eventType: string;
  insuredId: string;
  scheduleId: number;
  status: string;
  occurredAt: string;
}

export function makeAppointmentEvent(
  eventType: string,
  appointment: Appointment
): AppointmentEvent {
  return {
    eventId: randomUUID(),
    appointmentUuid: appointment.appointmentUuid,
    eventType,
    insuredId: appointment.insuredId,
    scheduleId: appointment.scheduleId,
    status: appointment.status,
    occurredAt: new Date().toISOString(),
  };
}
