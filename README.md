# Clinic Scheduling Platform

Backend platform for medical appointment scheduling built with **TypeScript**, **AWS Serverless**, and **Clean Architecture**.

This project simulates a production-grade healthcare booking workflow using asynchronous event-driven processing, multiple data stores, and scalable cloud services.

> Designed as a portfolio project to demonstrate backend engineering skills in distributed systems, serverless architecture, and maintainable code structure.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript / Node.js 20 |
| Runtime | AWS Lambda (nodejs20.x, arm64) |
| API | API Gateway HTTP API |
| State store | DynamoDB |
| Relational store | MySQL 8 on RDS (per-country) |
| Messaging | SNS → SQS fan-out |
| Event bus | EventBridge |
| IaC / Deploy | Serverless Framework v3 |
| Local dev | serverless-offline, Docker |
| Testing | Jest + ts-jest |
| Docs | OpenAPI / Swagger |

---

## Architecture

> **This project uses serverless architecture on AWS Lambda. Kubernetes does not apply.**

The application follows **Clean Architecture** principles:

- **Domain layer** — Entities (`Appointment`) and port contracts (`IAppointmentStateRepo`, `IMessageBus`, `ICountryBookingRepo`)
- **Application layer** — Use cases (`AppointmentService`)
- **Infrastructure layer** — Adapters for DynamoDB, MySQL, SNS, and EventBridge
- **API layer** — AWS Lambda handlers

### Serverless Event Flow

```text
Client
  ↓
API Gateway (HTTP API)
  ↓
createAppointment Lambda
  ↓  saves status=pending
DynamoDB
  ↓  publishes with countryISO MessageAttribute
SNS Topic (appointmentTopic)
  ↓  filtered by countryISO → PE or CL queue
SQS (appointments-pe / appointments-cl)
  ↓  country worker Lambda
MySQL RDS (country-specific DB)
  ↓  publishes AppointmentConfirmed
EventBridge (appointments-bus)
  ↓
SQS (appointments-confirmaciones)
  ↓
confirmAppointment Lambda
  ↓  updates status=completed
DynamoDB
```

Failed messages after 3 retries are routed to a Dead Letter Queue (14-day retention) per SQS queue.

---

## Project Structure

```text
src/
├── api/lambda/
│   ├── appointment.ts          HTTP handlers (create, list) + SQS confirm handler
│   └── appointment_country.ts  Unified country worker (PE + CL via factory)
├── app/usecases/
│   └── appointment.service.ts  Core use cases
├── docs/
│   └── openapi.yaml            OpenAPI contract
├── domain/
│   ├── entities/Appointment.ts
│   ├── ports/
│   │   ├── IAppointmentStateRepo.ts
│   │   ├── ICountryBookingRepo.ts
│   │   └── IMessageBus.ts
│   └── types.ts
├── infra/
│   ├── config/ddb.ts           DynamoDB client
│   ├── messaging/
│   │   ├── eventbridge.service.ts
│   │   └── sns.service.ts
│   ├── repos/
│   │   ├── DynamoAppointmentStateRepo.ts
│   │   └── MySQLCountryBookingRepo.ts
│   ├── db-init.ts              CloudFormation custom resource — creates MySQL tables
│   └── secrets-init.ts         CloudFormation custom resource — seeds SSM password
└── shared/
    └── http.ts                 HTTP response helpers
postman/
├── clinic-scheduling-platform.postman_collection.json
├── clinic-scheduling-platform.local.postman_environment.json
└── clinic-scheduling-platform.dev.postman_environment.json
tests/
├── appointment.handler.unit.test.ts
├── appointment.service.unit.test.ts
└── appointment_country.unit.test.ts
```

---

## API

### Create appointment

```http
POST /appointments
Content-Type: application/json

{
  "insuredId": "12345",
  "scheduleId": 10,
  "countryISO": "PE"
}
```

**Response 201**

```json
{
  "appointmentUuid": "b3d2f1a0-...",
  "insuredId": "12345",
  "scheduleId": 10,
  "countryISO": "PE",
  "status": "pending",
  "createdAt": "2026-06-01T12:00:00.000Z",
  "updatedAt": "2026-06-01T12:00:00.000Z"
}
```

**Validation errors (400)**

| Condition | Message |
|---|---|
| Missing body | `Required body` |
| Malformed JSON | `Invalid body (JSON)` |
| Missing fields | `insuredId, scheduleId and countryISO are required` |
| Invalid country | `countryISO must be 'PE' or 'CL'` |
| Non-numeric scheduleId | `scheduleId must be numeric` |

---

### List appointments by insured

```http
GET /appointments/{insuredId}
```

**Response 200**

```json
[
  {
    "appointmentUuid": "b3d2f1a0-...",
    "insuredId": "12345",
    "scheduleId": 10,
    "countryISO": "PE",
    "status": "completed",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
]
```

---

## Environment Variables

The following environment variables are injected by Serverless Framework at deploy time via CloudFormation references. No real values are hardcoded.

| Variable | Description |
|---|---|
| `TABLE_APPOINTMENTS` | DynamoDB table name |
| `SNS_APPOINTMENTS_ARN` | SNS topic ARN |
| `EB_BUS_NAME` | EventBridge bus name |
| `SQS_PE_URL` / `SQS_PE_ARN` | SQS queue for Peru |
| `SQS_CL_URL` / `SQS_CL_ARN` | SQS queue for Chile |
| `CONFIRMATIONS_SQS_URL` / `CONFIRMATIONS_SQS_ARN` | Confirmations queue |
| `RDS_PE_HOST_SSM` / `RDS_CL_HOST_SSM` | SSM parameter paths for RDS host |
| `RDS_PASSWORD_SSM` | SSM parameter path for RDS password |
| `RDS_USER` | RDS username |
| `RDS_PE_PORT` / `RDS_CL_PORT` | RDS port (default 3306) |
| `RDS_PE_DATABASE` / `RDS_CL_DATABASE` | Database names per country |

For local development with serverless-offline, set the variables you need in a `.env` file (not committed).

---

## Local Development

### Install dependencies

```bash
npm install
```

### Run locally (serverless-offline)

```bash
npm run offline
# API available at http://localhost:3000
```

The Dockerfile in the project root wraps this command for convenience:

```bash
docker build -t clinic-scheduling-platform .
docker run -p 3000:3000 clinic-scheduling-platform
```

> Docker is provided for local development only. The production deployment is serverless via AWS Lambda.

### Build

```bash
npm run build
# Output: dist/
```

---

## Testing

Unit tests cover:

- Lambda handler validation and routing (`appointment.handler.unit.test.ts`)
- Service layer: DynamoDB writes and SNS publish (`appointment.service.unit.test.ts`)
- Country worker handlers: SQS processing and EventBridge confirmation (`appointment_country.unit.test.ts`)

```bash
npm test
```

### Coverage

```bash
npm run test:coverage
# Reports to: coverage/
```

Coverage is enforced at **80% minimum** (statements, branches, functions, lines). Infrastructure adapters that require real AWS connections (MySQL, CloudFormation custom resources) are excluded from the threshold.

---

## Postman

The `postman/` folder contains the collection and two environments.

| File | Purpose |
|---|---|
| `clinic-scheduling-platform.postman_collection.json` | All requests with inline test scripts |
| `clinic-scheduling-platform.local.postman_environment.json` | `baseUrl = http://localhost:3000` (serverless-offline) |
| `clinic-scheduling-platform.dev.postman_environment.json` | `baseUrl = https://change-me.execute-api.region.amazonaws.com/dev` |

Import both the collection and the desired environment into Postman, activate the environment, then run the collection.

---

## OpenAPI

Full contract at `src/docs/openapi.yaml`. Generate a static HTML doc with:

```bash
npm run docs
# Output: docs/swagger.html
```

---

## Deploy

### Prerequisites

1. Configure your AWS credentials (`aws configure` or environment variables).
2. Set the VPC and subnet IDs for the RDS instances as environment variables:

```bash
export RDS_VPC_ID=vpc-xxxxxxxxxxxxxxx
export RDS_SUBNET_1=subnet-xxxxxxxxxxxxxxx
export RDS_SUBNET_2=subnet-xxxxxxxxxxxxxxx
```

These are read by `serverless.yml` at deploy time via `${env:RDS_VPC_ID}`. No real IDs are committed to the repository.

### Deploy stack

```bash
npx serverless deploy
```

### Remove stack

```bash
npx serverless remove
```

> No automated deploy pipeline is configured. All deployments are triggered manually.

---

## Logs

```bash
npx serverless logs -f createAppointment -t
npx serverless logs -f appointmentPE -t
npx serverless logs -f appointmentCL -t
npx serverless logs -f confirmAppointment -t
```

---

## GitHub Actions / CI

CI runs on every push and pull request to `main`.

Pipeline: `install → lint → build → test → coverage`

No AWS credentials are required. No automatic deploy is performed.

See `.github/workflows/ci.yml`.

---

## What This Project Demonstrates

- Clean Architecture with dependency inversion (ports & adapters)
- Event-driven systems with SNS fan-out → SQS per country
- Multi-database design: DynamoDB for state tracking, MySQL for relational persistence
- Parameterized Lambda handlers to eliminate code duplication
- Dead Letter Queues for reliability
- Typed Lambda events (`APIGatewayProxyEvent`, `SQSEvent`)
- AWS Serverless Framework with CloudFormation custom resources
- Unit testing with mocked AWS SDK clients (`aws-sdk-client-mock`)
- Jest coverage enforcement at 80% threshold

---

## Future Improvements

- Authentication / RBAC
- Place worker Lambdas inside the VPC — enables `PubliclyAccessible: false` on RDS and security group restriction to Lambda SG only
- Integration tests against real AWS resources
- CloudWatch alarms on DLQ depth
- Notifications (Email / SMS) on appointment confirmation

---

## Author

**AP Chavez**  
Backend Engineer focused on Node.js, TypeScript, AWS, and scalable systems.
