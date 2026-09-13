import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Reproducible, standalone deployment artifact, without frontend or secrets.
const root = JSON.parse(readFileSync("package.json", "utf8"));
const names = ["@nestjs/common", "@nestjs/core", "@nestjs/platform-express", "express", "reflect-metadata", "rxjs", "bcryptjs", "docx", "jose", "mongodb", "pdfkit", "zod"];
mkdirSync("backend/deploy", { recursive: true });
cpSync("backend/dist", "backend/deploy", { recursive: true });
cpSync("lib/reports/fonts", "backend/deploy/lib/reports/fonts", { recursive: true });
writeFileSync("backend/deploy/package.json", JSON.stringify({
  name: "saylani-nest-backend", version: "1.0.0", private: true, type: "module",
  scripts: { start: "node index.js" }, engines: { node: "24.x" },
  overrides: root.overrides,
  dependencies: Object.fromEntries(names.map(name => [name, root.dependencies[name]])),
}, null, 2));
writeFileSync("backend/deploy/index.js", `import "reflect-metadata";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./backend/app.module.js";
const server = express();
server.disable("x-powered-by");
const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { bodyParser: false });
app.use(express.raw({ type: () => true, limit: "2mb" }));
await app.init();
export default server;
`);
writeFileSync("backend/deploy/vercel.json", JSON.stringify({ framework: "nestjs", regions: ["sin1"] }, null, 2));
console.log("Packaged Nest backend in backend/deploy (no environment files).");
