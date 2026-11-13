import { createLocalDb } from "@/server/db/local";
import { seedDemoData, localCreateUser } from "@/server/db/seed";
import type { Db } from "@/server/db/types";

/** Fresh in-memory database with migrations + demo seed. */
export async function freshDb() {
  const { db, pg } = await createLocalDb("memory://");
  const seeded = await seedDemoData(db, await localCreateUser(db));
  return { db, pg, ...seeded };
}

export async function createUser(db: Db, email: string, name = "Test User") {
  const create = await localCreateUser(db);
  return create(email, "password123", name);
}
