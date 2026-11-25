import { test } from "node:test";
import request from "supertest";
import app from "../src/app";

test("an unknown route returns 404 with the agreed error body", async () => {
  await request(app)
    .get("/api/v1/missing")
    .expect(404)
    .expect({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
});

test("an invalid detail value returns 400 with a field message", async () => {
  await request(app)
    .get("/api/v1/health?detail=wrong")
    .expect(400)
    .expect({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fields: {
          detail: "Choose brief or full",
        },
      },
    });
});

test("health returns 200 when the database responds", async () => {
  await request(app)
    .get("/api/v1/health")
    .expect(200)
    .expect({
      status: "ok",
      database: "up",
    });
});