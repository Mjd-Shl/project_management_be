import { copyFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
}

if (!existsSync("node_modules/tsx/package.json")) {
  execFileSync(process.execPath, [process.env.npm_execpath, "ci"], {
    stdio: "inherit",
  });
}

if (!existsSync("node_modules/.prisma/client/schema.prisma")) {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "generate"], {
    stdio: "inherit",
  });
}