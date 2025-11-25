import { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../lib/prisma.ts';
import { s3Client } from '../../lib/s3.ts';
import { addTranslationJob } from './translation.queue.ts';
import { GetUploadUrlInput, ConfirmUploadInput } from './translation.schema.ts';
import { env } from '../../config/env.ts';
import redis from '../../config/redis.ts';
import { logger } from '../../lib/logger.ts';

// Helper: Get User ID (assuming Auth Middleware attaches it)
const getUserId = (req: Request) => (req as any).user?.userId;

/**
 * Step 1: Generate S3 Presigned URL
 * Frontend calls this to get permission to upload a file.
 */
export const getUploadUrl = async (req: Request<{}, {}, GetUploadUrlInput>, res: Response) => {
  try {
    const { filename, targetLang, model } = req.body;
    const userId = getUserId(req);

    // Unique S3 Key: uploads/{userId}/{timestamp}_{cleanFilename}
    const s3Key = `uploads/${userId}/${Date.now()}_${filename.replace(/\s+/g, '_')}`;

    // 1. Create Database Record (Status: PENDING)
    const job = await prisma.job.create({
      data: {
        userId,
        originalFileKey: s3Key,
        sourceLang: 'auto', // We let Gemini detect this
        targetLang,
        modelUsed: model,
        status: 'PENDING',
      },
    });

    // 2. Generate Presigned PUT URL (Valid for 15 mins)
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: s3Key,
        ContentType: 'text/plain', // SRT files are text
      }),
      { expiresIn: 900 } // 15 minutes
    );

    logger.info({ jobId: job.id, userId }, 'Upload URL generated');

    res.json({ 
      uploadUrl, 
      jobId: job.id,
      s3Key // Useful for debugging, but frontend technically mostly needs URL
    });

  } catch (error) {
    logger.error(error, 'Error generating upload URL');
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

/**
 * Step 2: Confirm Upload & Enqueue
 * Frontend calls this AFTER successfully uploading to S3.
 */
export const confirmUpload = async (req: Request<{}, {}, ConfirmUploadInput>, res: Response) => {
  try {
    const { jobId } = req.body;
    const userId = getUserId(req);

    // 1. Verify Job belongs to User and is PENDING
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    if (job.status !== 'PENDING') {
      return res.status(400).json({ error: 'Job is already queued or processed' });
    }

    // 2. Update DB Status -> QUEUED
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'QUEUED' },
    });

    // 3. Push to BullMQ
    await addTranslationJob({
      jobId: job.id,
      userId: job.userId,
      s3Key: job.originalFileKey,
      targetLang: job.targetLang,
      modelId: job.modelUsed,
    });

    // 4. Invalidate Redis Cache (so next polling fetches fresh QUEUED status)
    await redis.del(`job:${jobId}`);

    res.json({ success: true, status: 'QUEUED' });

  } catch (error) {
    logger.error(error, 'Error confirming upload');
    res.status(500).json({ error: 'Failed to queue translation job' });
  }
};

/**
 * Step 3: Poll Job Status
 * Frontend polls this every few seconds.
 */
export const getJobStatus = async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params; 
  const userId = getUserId(req);

  if (!id) {
     return res.status(400).json({ error: 'Job ID is missing.' });
  }
  
  try {
    const cacheKey = `job:${id}`;

    // Check Redis Cache First
    const cachedJob = await redis.get(cacheKey);
    if (cachedJob) {
      const jobData = JSON.parse(cachedJob);
      if (jobData.userId !== userId) {
          return res.status(403).json({ error: 'Unauthorized access to job.' });
      }
      return res.json(jobData);
    }

    // Database Fallback
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }

    // If Completed, Generate Download URL
    let downloadUrl: string | null = null;
    
    if (job.status === 'COMPLETED' && job.translatedFileKey) {
      downloadUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: env.AWS_BUCKET_NAME,
          Key: job.translatedFileKey,
        }),
        { expiresIn: 3600 }
      );
    }

    const responseData = { ...job, downloadUrl };

    // D. Save to Redis
    const ttl = job.status === 'COMPLETED' || job.status === 'FAILED' ? 3600 : 5; 
    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', ttl);

    res.json(responseData);

  } catch (error) {
    logger.error(error, 'Error fetching job status');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};