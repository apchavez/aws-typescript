import mysql from "mysql2/promise";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import type { Appointment } from "../../domain/entities/Appointment";
import type { ICountryBookingRepo } from "../../domain/ports/ICountryBookingRepo";
import { logger } from "../../shared/logger";
import { RDS_CA_BUNDLE } from "../rds-ca-bundle";

const ssm = new SSMClient({});
let cachedPassword: string | null = null;

async function getPassword(): Promise<string> {
  if (process.env.RDS_PASSWORD && process.env.RDS_PASSWORD.trim() !== "") {
    return process.env.RDS_PASSWORD;
  }
  if (cachedPassword) return cachedPassword;
  const name = process.env.RDS_PASSWORD_SSM;
  if (!name) throw new Error("RDS_PASSWORD_SSM is not defined");
  const out = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );
  const value = out.Parameter?.Value ?? "";
  if (!value) throw new Error("Could not read SSM password or it is empty");
  cachedPassword = value;
  return cachedPassword;
}

function cfg() {
  return {
    host: process.env.RDS_HOST!,
    port: Number(process.env.RDS_PORT ?? 3306),
    user: process.env.RDS_USER!,
    database: process.env.RDS_DATABASE!,
  };
}

let pool: mysql.Pool | null = null;

async function getPool(): Promise<mysql.Pool> {
  if (pool) return pool;
  const password = await getPassword();
  const { host, port, user, database } = cfg();
  logger.info("Creating RDS connection pool", { host, database, user });
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 2,
    ssl: { ca: RDS_CA_BUNDLE, rejectUnauthorized: true },
  });
  return pool;
}

export class MySQLCountryBookingRepo implements ICountryBookingRepo {
  async book(appointment: Appointment): Promise<void> {
    const pool = await getPool();
    const sql = `
      INSERT INTO appointments
        (appointment_uuid, insured_id, schedule_id, country_iso, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(sql, [
      appointment.appointmentUuid,
      appointment.insuredId,
      appointment.scheduleId,
      appointment.countryISO,
      appointment.status,
      appointment.createdAt,
      appointment.updatedAt,
    ]);
  }
}
