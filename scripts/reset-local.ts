/** Deletes the local demo database so it is re-created and re-seeded on next start. */
import { rmSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.env.LOCAL_DB_DIR || ".data/pglite");
rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}. Restart the dev server to re-seed fresh demo data.`);
