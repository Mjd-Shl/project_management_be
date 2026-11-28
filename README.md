# Project Management API

A backend API built with Express and TypeScript in strict mode. It uses Prisma 7 to connect to PostgreSQL 16, Zod to validate input, and Pino to log requests.

## Local setup

Install Git, Node.js 24 with npm, and Docker with Docker Compose. Start Docker before running these commands.

```sh
git clone https://github.com/Mjd-Shl/project_management_be.git
cd project_management_be
docker compose up -d
npm run dev
```

Docker Compose starts PostgreSQL. On a fresh clone, `npm run dev` copies `.env.example` to `.env` and installs the dependencies. Each time you run `npm run dev`, it generates Prisma Client before starting the API.

The first setup requires internet access to download the PostgreSQL image and npm packages. Leave the API terminal open.

## Check that the API works

Open `http://localhost:3000/api/v1/health` in your browser. The API runs `SELECT 1` through Prisma to check that PostgreSQL responds. A successful check returns HTTP `200` with this body:

```json
{"status":"ok","database":"up"}
```

To check PostgreSQL directly, run `docker compose ps` in a second terminal and look for `healthy`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Prepare the local environment, generate Prisma Client, and start the API in watch mode |
| `npm run predev` | Run the setup and client generation steps on their own |
| `npm run lint` | Check the code with ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the API tests, including the health check against PostgreSQL |

Start PostgreSQL before running `npm test`.

## Environment variables

The repository includes `.env.example` with local development defaults. Git ignores your `.env` file.

| Variable | Local default | Purpose |
| --- | --- | --- |
| `POSTGRES_DB` | `project_management` | Database name used when PostgreSQL first starts with an empty volume |
| `POSTGRES_USER` | `project_dev` | Local database user |
| `POSTGRES_PASSWORD` | `local_dev_only` | Password for the local database user |
| `POSTGRES_PORT` | `5432` | Port your computer uses to reach PostgreSQL |
| `DATABASE_URL` | See `.env.example` | Connection string Prisma uses to reach the database |

If port `5432` is unavailable on your computer, copy `.env.example` to `.env` before starting Docker Compose. Set `POSTGRES_PORT=5433` and change the port in `DATABASE_URL` to `5433` too. The API listens on port `3000`.

## Prisma model files

Keep the `generator` and `datasource` blocks in `prisma/schema.prisma`. The `schema` setting in `prisma.config.ts` points to the whole `prisma` folder, so each model can have its own `.prisma` file.

For example, when the team adds a `Task` model, its definition can go in `prisma/task.prisma` alongside `schema.prisma`.

After changing a model, run:

```sh
npx prisma validate
npx prisma generate
```

`validate` checks the schema files together. `generate` updates the TypeScript client in `src/generated/prisma`. Running `npm run dev` also generates the client. Commit your handwritten `.prisma` files. Git ignores the generated client.

## Error responses

An unknown route such as `GET /api/v1/missing` returns HTTP `404`:

```json
{"error":{"code":"NOT_FOUND","message":"Route not found"}}
```

The health endpoint accepts `brief` or `full` for the optional `detail` query parameter. An invalid value such as `GET /api/v1/health?detail=wrong` returns HTTP `400`:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","fields":{"detail":"Choose brief or full"}}}
```

The `fields` object appears only on validation errors. Each entry names the field that failed and explains how to fix it.

## Pull request checks

The GitHub Actions workflow defines a job named `Backend checks` for pull requests. It starts PostgreSQL 16, installs dependencies, generates Prisma Client, and runs lint, type checking, and the API tests.