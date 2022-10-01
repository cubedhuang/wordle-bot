import { PrismaClient } from "@prisma/client";

// Allow BigInt Serialization
(BigInt.prototype as any).toJSON = BigInt.prototype.toString;

export const db = new PrismaClient();
