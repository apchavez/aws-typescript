import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SQSEvent,
} from "aws-lambda";
import { appointmentMakeService } from "../../index";
import { ok, created, bad, forbidden, internal } from "../../shared/http";
import { getAuthContext } from "../../shared/auth";
import { logger } from "../../shared/logger";

const INSURED_ID_RE = /^\d{5}$/;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const svc = appointmentMakeService();

function parsePageSize(raw: string | undefined): number {
  if (!raw) return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) return DEFAULT_PAGE_SIZE;
  return n;
}

export const createAppointment = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (!event.body) return bad("Required body");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body) as Record<string, unknown>;
  } catch {
    return bad("Invalid body (JSON)");
  }

  const { insuredId, scheduleId, contactEmail } = payload;

  if (!insuredId || scheduleId == null) {
    return bad("insuredId and scheduleId are required");
  }
  if (!INSURED_ID_RE.test(String(insuredId))) {
    return bad("insuredId must be 5 digits");
  }
  if (Number.isNaN(Number(scheduleId)) || Number(scheduleId) < 1) {
    return bad("scheduleId must be a positive integer");
  }

  const auth = getAuthContext(event);
  if (!auth) return forbidden();

  if (auth.role === "insured" && String(insuredId) !== auth.sub) {
    return forbidden("insured can only book appointments for themselves");
  }

  try {
    logger.info("createAppointment invoked", { insuredId: String(insuredId), scheduleId: Number(scheduleId) });
    const appointment = await svc.create({
      insuredId: String(insuredId),
      scheduleId: Number(scheduleId),
      contactEmail: contactEmail ? String(contactEmail) : undefined,
    });
    return created(appointment);
  } catch (err) {
    logger.error("createAppointment failed", { error: String(err) });
    return internal();
  }
};

export const listByInsured = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const insuredId = event.pathParameters?.insuredId;
  if (!insuredId) return bad("insuredId required");
  if (!INSURED_ID_RE.test(insuredId)) return bad("insuredId must be 5 digits");

  const auth = getAuthContext(event);
  if (!auth) return forbidden();

  if (auth.role === "insured" && insuredId !== auth.sub) {
    return forbidden("insured can only view their own appointments");
  }

  try {
    const pageSize = parsePageSize(event.queryStringParameters?.pageSize);
    const cursor = event.queryStringParameters?.cursor;
    const page = await svc.listByInsured(String(insuredId), pageSize, cursor);
    return ok(page);
  } catch (err) {
    logger.error("listByInsured failed", { insuredId, error: String(err) });
    return internal();
  }
};

export const getAppointmentHistory = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const appointmentUuid = event.pathParameters?.appointmentUuid;
  if (!appointmentUuid) return bad("appointmentUuid required");

  const auth = getAuthContext(event);
  if (!auth) return forbidden();

  try {
    const events = await svc.getHistory(appointmentUuid);
    if (
      auth.role === "insured" &&
      events.length > 0 &&
      events[0].insuredId !== auth.sub
    ) {
      return forbidden("insured can only view their own appointment history");
    }
    return ok(events);
  } catch (err) {
    logger.error("getAppointmentHistory failed", { appointmentUuid, error: String(err) });
    return internal("Internal error fetching appointment history");
  }
};

export const confirmAppointment = async (event: SQSEvent): Promise<void> => {
  logger.info("confirmAppointment invoked", { recordCount: event.Records.length });
  for (const r of event.Records) {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(r.body) as Record<string, unknown>;
    } catch {
      logger.warn("confirmAppointment: skipping malformed record", {
        messageId: r.messageId,
      });
      continue;
    }
    const detail = (body.detail ?? body) as Record<string, unknown>;
    const { appointmentUuid } = detail;
    if (!appointmentUuid) {
      logger.warn("confirmAppointment: record missing appointmentUuid", {
        messageId: r.messageId,
      });
      continue;
    }
    await svc.complete(String(appointmentUuid));
  }
};
