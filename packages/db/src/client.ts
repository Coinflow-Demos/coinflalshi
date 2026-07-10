import {PrismaClient} from '@prisma/client';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const db = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = db;
}

export * from '@prisma/client';
