/**
 * WhatsApp module uses the same Postgres pool as the voice backend,
 * with the WhatsApp Drizzle schema so table names do not collide.
 */
export { pool } from "../db";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../db";
import * as schema from "@shared/whatsapp-schema";

export const db = drizzle(pool, { schema });
export const dbRead = db;
