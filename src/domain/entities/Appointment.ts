import { Status } from "../types";

export interface Appointment {
  appointmentUuid: string;
  insuredId: string;
  scheduleId: number;
  status: Status;
  createdAt: string;
  updatedAt: string;
  contactEmail?: string;
}
