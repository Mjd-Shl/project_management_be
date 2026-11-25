import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = Object.create(null);

    for (const issue of err.issues) {
      const field = issue.path.join(".") || "request";
      fields[field] ??= issue.message;
    }

    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fields,
      },
    });
    return;
  }

  req.log.error({ err }, "Unexpected request error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};