import { AppointmentCountryService } from "../src/app/usecases/appointment-country.service";
import type { ICountryBookingRepo } from "../src/domain/ports/ICountryBookingRepo";
import type { IConfirmationBus } from "../src/domain/ports/IConfirmationBus";
import type { Appointment } from "../src/domain/entities/Appointment";

const appointment: Appointment = {
  appointmentUuid: "u1",
  insuredId: "01234",
  scheduleId: 100,
  countryISO: "PE",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AppointmentCountryService", () => {
  let bookingRepo: jest.Mocked<ICountryBookingRepo>;
  let confirmationBus: jest.Mocked<IConfirmationBus>;
  let svc: AppointmentCountryService;

  beforeEach(() => {
    bookingRepo = { book: jest.fn() };
    confirmationBus = { send: jest.fn() };
    svc = new AppointmentCountryService(bookingRepo, confirmationBus);
  });

  test("process -> books the appointment in the country repo then sends confirmation", async () => {
    bookingRepo.book.mockResolvedValue(undefined);
    confirmationBus.send.mockResolvedValue(undefined);

    await svc.process(appointment);

    expect(bookingRepo.book).toHaveBeenCalledTimes(1);
    expect(bookingRepo.book).toHaveBeenCalledWith(appointment);

    expect(confirmationBus.send).toHaveBeenCalledTimes(1);
    expect(confirmationBus.send).toHaveBeenCalledWith(appointment.appointmentUuid);
  });

  test("process -> does not send confirmation if booking fails", async () => {
    bookingRepo.book.mockRejectedValue(new Error("DB error"));

    await expect(svc.process(appointment)).rejects.toThrow("DB error");

    expect(confirmationBus.send).not.toHaveBeenCalled();
  });

  test("process -> propagates confirmation bus errors", async () => {
    bookingRepo.book.mockResolvedValue(undefined);
    confirmationBus.send.mockRejectedValue(new Error("EventBridge error"));

    await expect(svc.process(appointment)).rejects.toThrow("EventBridge error");

    expect(bookingRepo.book).toHaveBeenCalledTimes(1);
  });

  test("process -> books a CL appointment the same way as PE", async () => {
    bookingRepo.book.mockResolvedValue(undefined);
    confirmationBus.send.mockResolvedValue(undefined);

    const clAppointment = { ...appointment, countryISO: "CL" as const };
    await svc.process(clAppointment);

    expect(bookingRepo.book).toHaveBeenCalledWith(clAppointment);
    expect(confirmationBus.send).toHaveBeenCalledWith(appointment.appointmentUuid);
  });
});
