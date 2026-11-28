import type { Request, Response } from "express";
import { checkDatabase } from "../services/database";

export async function getHealth(_req: Request, res: Response) {
  await checkDatabase();
  res.status(200).json({ status: "ok", database: "up" });
}