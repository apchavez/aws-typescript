import type { Appointment } from "../../domain/entities/Appointment";
import type { ICountryBookingRepo } from "../../domain/ports/ICountryBookingRepo";
import type { IConfirmationBus } from "../../domain/ports/IConfirmationBus";

export class AppointmentCountryService {
  constructor(
    private readonly bookingRepo: ICountryBookingRepo,
    private readonly confirmationBus: IConfirmationBus
  ) {}

  async process(appointment: Appointment): Promise<void> {
    await this.bookingRepo.book(appointment);
    await this.confirmationBus.send(appointment.appointmentUuid);
  }
}
