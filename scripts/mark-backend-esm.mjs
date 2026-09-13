import { writeFileSync } from "node:fs";
writeFileSync("backend/dist/package.json", JSON.stringify({ type: "module" }));
