import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';
import { env } from '../config/env.ts';

// Making sure neon uses websockets
neonConfig.webSocketConstructor = ws;

// Prevents multiple instances of Prisma to open
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Opening Connection to Neon.tech PostgreSQL 
const pool = new Pool({ 
  connectionString: env.DATABASE_URL 
});

// Initializing Adapter
const adapter = new PrismaNeon(pool);

// Export Prisma Client to use a shared connection
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;