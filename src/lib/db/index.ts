import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __client?: ReturnType<typeof postgres> };

let cached: Db | undefined;

function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
    );
  }
  const client = globalForDb.__client ?? postgres(url, { prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.__client = client;
  cached = drizzle(client, { schema });
  return cached;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
