import { DefaultJobOptions, WorkerOptions } from 'bullmq';
import { env } from './env.ts'; 
import connection from './redis.ts';

// Queue Name
export const QUEUE_NAMES = {
  TRANSLATION: 'translation-queue',
} as const;

// Default Job Behavior
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3, // Try to perform the job 3 times 
  backoff: {
    type: 'exponential', // To increase the time that a job hit on API 
    delay: 1000,
  },
  removeOnComplete: {
    age: 2 * 3600, // Keep for 2 hours
    count: 10,     // Max 10 entries
  },
  removeOnFail: {
    age: 24 * 3600, // Keep for 24 hours to check what went wrong (will be made shorted if needed)
    count: 10, // Max 10 entries
  },
};

// Producer Queue Config (For the API)
// Using connection made by config/redis.ts
export const queueConfig = {
  connection,
  defaultJobOptions,
};

// Worker Config
// Creating separate connection for worker 
export const workerConfig: WorkerOptions = {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  },
  concurrency: 1, //Process only 1 job (just for now, my server slow :( )
  lockDuration: 30000, // If worker stops responding for 30s, give the job to some other worker 
};