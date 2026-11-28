import express from "express";
import pinoHttp from "pino-http";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const port = 3000;

app.use(pinoHttp());
app.use("/api/v1", healthRouter);

app.get("/", (req, res) => {
  res.send("API is running");
});

// A request reaches this point when no route matched.
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});