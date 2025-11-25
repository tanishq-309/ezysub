import { Queue } from 'bullmq';
import { queueConfig, QUEUE_NAMES } from '../../config/queue.js';
import { TranslationJobData } from './translation.types.js';
import { logger } from '../../lib/logger.js';

// Initialize the Queue (Producer side)
export const translationQueue = new Queue<TranslationJobData>(
  QUEUE_NAMES.TRANSLATION, 
  queueConfig
);

// Helper to add jobs
export const addTranslationJob = async (jobData: TranslationJobData) => {
  try {
    const job = await translationQueue.add('translate-srt', jobData);
    
    logger.info({ 
      jobId: job.id, 
      userId: jobData.userId,
      model: jobData.modelId 
    }, 'Job added to BullMQ');

    return job;
  } catch (error) {
    logger.error(error, 'Failed to add translation job to queue');
    throw error;
  }
};