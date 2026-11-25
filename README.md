# Project Management API

An Express and TypeScript API with PostgreSQL 16, Prisma, Zod validation, and Pino request logging.

## Local setup

Install Git, Node.js 24 with npm, and Docker with Docker Compose. Start Docker before running the commands below.

```sh
git clone https://github.com/Mjd-Shl/project_management_be.git
cd project_management_be
docker compose up -d
npm run dev
```

On the first run, `npm run dev` copies `.env.example` to `.env`, installs dependencies, and generates Prisma Client when needed. The first run requires internet access. Leave the API terminal open.

Open http://localhost:3000/api/v1/health. When PostgreSQL responds, the API returns HTTP 200:

```json
{"status":"ok","database":"up"}
```

To check database readiness, run `docker compose ps` in a second terminal and look for `healthy`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Prepare the local environment and start the API in watch mode |
| `npm run predev` | Run the setup step by itself |
| `npm run lint` | Check the code with ESLint |
| `npm run typecheck` | Check strict TypeScript types |
| `npm test` | Run the API tests. The health test requires PostgreSQL to be running. |

## Environment variables

| Variable | Local default | Purpose |
| --- | --- | --- |
| `POSTGRES_DB` | `project_management` | Database created on first initialization |
| `POSTGRES_USER` | `project_dev` | Local database user |
| `POSTGRES_PASSWORD` | `local_dev_only` | Password for local development |
| `POSTGRES_PORT` | `5432` | Port exposed on your computer |
| `DATABASE_URL` | See `.env.example` | Connection string Prisma uses to reach PostgreSQL |

If port `5432` is unavailable, copy `.env.example` to `.env` before starting Compose. Change `POSTGRES_PORT` to `5433` and change the port in `DATABASE_URL` to `5433` too. The API listens on port `3000`.

## Error responses

An unknown route returns HTTP 404:

```json
{"error":{"code":"NOT_FOUND","message":"Route not found"}}
```

Invalid input returns HTTP 400. For example, `GET /api/v1/health?detail=wrong` returns:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","fields":{"detail":"Choose brief or full"}}}
```

`fields` maps each invalid field to its message and appears only on validation errors.

## Pull request checks

The `Backend checks` job starts PostgreSQL 16 and runs lint, type checking, and tests on every pull request.