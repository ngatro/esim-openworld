import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Configure connection pool for better concurrency
  const pool = new Pool({
    connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Fail fast if connection cannot be established
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // Optional: log queries in development
    log: process.env.NODE_ENV === "development" ? [ "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
