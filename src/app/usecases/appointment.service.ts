import { randomUUID } from "crypto";
import type { Appointment } from "../../domain/entities/Appointment";
import { makeAppointmentEvent, AppointmentEvent } from "../../domain/entities/AppointmentEvent";
import type { IAppointmentStateRepo, Page } from "../../domain/ports/IAppointmentStateRepo";
import type { IAppointmentEventStore } from "../../domain/ports/IAppointmentEventStore";
import type { IAppointmentNotifier } from "../../domain/ports/IAppointmentNotifier";
import type { IMessageBus } from "../../domain/ports/IMessageBus";
import { logger } from "../../shared/logger";

export class AppointmentService {
  constructor(
    private readonly stateRepo: IAppointmentStateRepo,
    private readonly messageBus: IMessageBus,
    private readonly eventStore: IAppointmentEventStore,
    private readonly notifier: IAppointmentNotifier
  ) {}

  async create(input: {
    insuredId: string;
    scheduleId: number;
    contactEmail?: string;
  }): Promise<Appointment> {
    const now = new Date().toISOString();
    const appointment: Appointment = {
      appointmentUuid: randomUUID(),
      insuredId: input.insuredId,
      scheduleId: input.scheduleId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      contactEmail: input.contactEmail,
    };
    await this.stateRepo.save(appointment);
    await this.messageBus.publish(appointment);
    await this.eventStore.append(makeAppointmentEvent("APPOINTMENT_CREATED", appointment));
    logger.info("appointment created", {
      appointmentUuid: appointment.appointmentUuid,
      insuredId: appointment.insuredId,
      scheduleId: appointment.scheduleId,
    });
    return appointment;
  }

  listByInsured(
    insuredId: string,
    pageSize?: number,
    cursor?: string
  ): Promise<Page<Appointment>> {
    return this.stateRepo.listByInsured(insuredId, pageSize, cursor);
  }

  getById(appointmentUuid: string): Promise<Appointment | null> {
    return this.stateRepo.findById(appointmentUuid);
  }

  getHistory(appointmentUuid: string): Promise<AppointmentEvent[]> {
    return this.eventStore.findByAppointmentId(appointmentUuid);
  }

  async complete(appointmentUuid: string): Promise<void> {
    await this.stateRepo.markCompleted(appointmentUuid);
    const appointment = await this.stateRepo.findById(appointmentUuid);
    if (!appointment) {
      logger.warn("complete: appointment not found after markCompleted", { appointmentUuid });
      return;
    }
    await this.eventStore.append(makeAppointmentEvent("APPOINTMENT_COMPLETED", appointment));
    await this.notifier.notifyCompleted(appointment);
    logger.info("appointment completed", { appointmentUuid, insuredId: appointment.insuredId });
  }
}
