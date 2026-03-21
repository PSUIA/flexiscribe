import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare const globalThis: {
  prismaGlobal: PrismaClient;
} & typeof global;


function sanitizeConnectionString(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    // Not a valid URL (shouldn't happen, but don't crash startup)
    return url;
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

// Reuse Prisma client across hot reloads (dev) and serverless function invocations (prod)
const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

// Store in global object to maintain a single instance when this module is reloaded
globalThis.prismaGlobal = prisma;