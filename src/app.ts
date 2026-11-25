import express from "express";
import pinoHttp from "pino-http";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(pinoHttp());
app.use("/api/v1", healthRouter);

app.get("/", (_req, res) => {
  res.send("API is running");
});

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

app.use(errorHandler);

export default app;