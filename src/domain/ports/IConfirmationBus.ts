export interface IConfirmationBus {
  send(appointmentUuid: string): Promise<void>;
}
