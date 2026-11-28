import { z } from "zod";

export const healthQuerySchema = z.object({
  detail: z.enum(["brief", "full"], {
    error: "Choose brief or full",
  }).default("brief"),
});