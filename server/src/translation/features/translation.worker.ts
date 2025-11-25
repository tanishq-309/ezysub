import { Job } from 'bullmq';
import { GoogleGenerativeAI } from '@google/genai';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslationJobData } from './translation.types.ts';
import { prisma } from '../../lib/prisma.ts';
import { s3Client } from '../../lib/s3.ts';
import { env } from '../../config/env.ts';
import { logger } from '../../lib/logger.ts';
import redis from '../../config/redis.ts';

// --- Configuration and Utilities ---

// Map user model choice to actual Gemini model names
const getModel = (modelId: string) => {
  switch (modelId) {
    case 'gemini-1.5-pro':
      return 'gemini-1.5-pro';
    case 'gemini-1.5-flash':
        return 'gemini-1.5-flash'
    default:
      // Use the cheapest and fastest available model as default/fallback
      return 'gemini-1.5-flash';
  }
};

// Initializes the Gemini client once per worker run
const initGeminiClient = () => {
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
};

// --- Core Processor Logic ---

/**
 * The main function run by the BullMQ Worker to handle the translation job.
 */
export const translationProcessor = async (job: Job<TranslationJobData>) => {
  const { jobId, s3Key, targetLang, modelId } = job.data;
  
  // Update job status in Postgres and Redis cache to show it's started
  await prisma.job.update({ 
    where: { id: jobId }, 
    data: { status: 'PROCESSING' } 
  });
  // Invalidate job status in Redis so polling clients get the new 'PROCESSING' status quickly
  await redis.del(`job:${jobId}`);

  try {
    // 1. Download Source File from S3
    logger.info({ jobId, s3Key }, 'Downloading file from S3...');
    const s3DownloadResponse = await s3Client.send(new GetObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: s3Key,
    }));

    // Convert the stream body to a single string (subtitle content)
    const srtContent = await s3DownloadResponse.Body?.transformToString() || '';
    if (!srtContent) {
        throw new Error('Downloaded file was empty or corrupted.');
    }
    
    // 2. Prepare AI Call (Model Strategy)
    const gemini = initGeminiClient();
    const geminiModelName = getModel(modelId);
    
    // Construct the context-aware prompt for the LLM
    const prompt = `
      You are an expert subtitle translator. Your task is to translate the provided 
      SRT file content into the target language.

      Rules:
      1. YOU MUST PRESERVE ALL SRT FORMATTING. Do not change the sequence numbers or timestamps (HH:MM:SS,ms --> HH:MM:SS,ms).
      2. Translate ONLY the dialogue text.
      3. Target Language: ${targetLang}.
      4. Output ONLY the translated SRT content. Do not include any explanation or markdown tags.
      
      SRT Content to Translate:
      ---
      ${srtContent}
      ---
    `;

    // 3. Execute Translation
    logger.info({ jobId, model: geminiModelName }, 'Sending content to Gemini for translation...');
    
    const result = await gemini.models.generateContent({
        model: geminiModelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // Setting a high temperature is usually unnecessary for translation
        config: {
          temperature: 0.2,
          // Max output should be high enough for the whole translated file
          maxOutputTokens: 8192, 
        }
    });
    
    const translatedText = result.response.text.trim();
    
    if (!translatedText) {
        throw new Error('Gemini returned an empty response.');
    }

    // 4. Upload Translated File to S3
    const outputKey = s3Key.replace('uploads/', 'results/').replace('.srt', `.${targetLang}.srt`);
    
    logger.info({ jobId, outputKey }, 'Uploading translated file to S3...');
    await s3Client.send(new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: outputKey,
      Body: translatedText,
      ContentType: 'text/srt',
    }));

    // 5. Finalize Job Status
    await prisma.job.update({ 
      where: { id: jobId }, 
      data: { 
        status: 'COMPLETED', 
        translatedFileKey: outputKey,
        // TODO: Optionally save token usage from the Gemini response here 
      } 
    });

    // 6. Invalidate and Pre-cache Final Status in Redis
    // We update the cache so the next client poll gets the final status immediately.
    await redis.del(`job:${jobId}`); // Delete the old 'PROCESSING' cache key

    logger.info({ jobId, outputKey, targetLang }, 'Translation pipeline completed successfully.');
    
    // The worker should return the final result data for BullMQ to save in its logs
    return { translatedFileKey: outputKey };

  } catch (error) {
    logger.error(error, `Job ${jobId} failed during processing.`);
    
    // Update DB to FAILED
    await prisma.job.update({ 
      where: { id: jobId }, 
      data: { 
        status: 'FAILED',
        errorMessage: (error instanceof Error ? error.message : 'Unknown processing error'),
      } 
    });
    
    // The worker MUST re-throw the error to signal BullMQ to trigger the retry logic
    throw error;
  }
};