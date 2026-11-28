import { Router } from "express";
import { getHealth } from "../controllers/health";
import { validate } from "../middleware/validate";
import { healthQuerySchema } from "../validators/health";

const healthRouter = Router();

healthRouter.get("/health", validate(healthQuerySchema, "query"), getHealth);

export default healthRouter;