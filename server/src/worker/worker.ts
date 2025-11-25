import { Worker } from 'bullmq';
import { workerConfig, QUEUE_NAMES } from '../config/queue.ts';
import { translationProcessor } from '../features/translation/translation.worker.ts';
import { logger } from '../lib/logger.ts';

/**
 * The main worker entry point. 
 * This file is run as a separate process in production (e.g., via PM2 or Docker).
 * It listens to the central BullMQ queue defined in Redis.
 */
function startWorker() {
  logger.info(`Starting BullMQ Worker for queue: ${QUEUE_NAMES.TRANSLATION}`);

  // 1. Initialize the Worker
  // The worker connects to Redis using the dedicated connection settings 
  // defined in workerConfig (from queue.ts).
  const translationWorker = new Worker(
    QUEUE_NAMES.TRANSLATION, 
    // This is the function that contains the S3/Gemini logic (the heavy lifting)
    translationProcessor, 
    workerConfig
  );

  // 2. Event Handlers (Observability)
  // These events help you monitor the job lifecycle in your logs.
  
  translationWorker.on('active', job => {
    logger.info({ jobId: job.id, name: job.name }, 'Job started processing');
  });

  translationWorker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Job successfully completed');
    // NOTE: Job result cleanup is handled automatically by removeOnComplete in queueConfig
  });

  translationWorker.on('failed', (job, error) => {
    logger.error(error, `Job ${job?.id} failed after ${job?.attemptsMade} attempts.`);
    // BullMQ automatically handles retries based on the job options.
  });

  translationWorker.on('error', (err) => {
    logger.error(err, 'Worker experienced a non-job related error (e.g., Redis connection issue)');
  });

  // 3. Graceful Shutdown
  // Ensures that when the server process is told to stop (SIGTERM), 
  // the worker finishes its current job before shutting down.
  const handleShutdown = async () => {
    logger.info('Received shutdown signal. Waiting for current jobs to finish...');
    await translationWorker.close();
    logger.info('BullMQ Worker shut down gracefully.');
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown); // Ctrl+C during local dev
}

startWorker();