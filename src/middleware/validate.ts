import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validate(
  schema: ZodType,
  source: "query" | "body" | "params"
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(result.error);
    }

    res.locals.validated = result.data;
    next();
  };
}