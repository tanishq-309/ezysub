import { z } from 'zod';

/**
 * Schema for POST /api/translate/upload-url
 * Validates the initial request to start a job
 */
export const getUploadUrlSchema = z.object({
  body: z.object({
    // Enforce specific file extensions to prevent people uploading .exe or .jpg
    filename: z.string()
      .min(1, "Filename is required")
      .regex(/\.(srt|vtt|txt)$/i, "Invalid file type. Only .srt, .vtt, and .txt are supported."),
    
    // Strictly enforce 2-letter ISO codes (e.g., 'en', 'es', 'jp')
    targetLang: z.string()
      .length(2, "Target language must be a 2-letter ISO code (e.g., 'es', 'fr')"),
    
    // Whitelist allowed AI models. If they send "gpt-4", it will fail here.
    model: z.enum(['gemini-1.5-flash', 'gemini-1.5-pro'])
      .default('gemini-1.5-flash'),
  }),
});

/**
 * Schema for POST /api/translate/confirm
 * Validates that the user is trying to confirm a valid Job ID.
 */
export const confirmUploadSchema = z.object({
  body: z.object({
    jobId: z.string().uuid("Invalid Job ID format"),
  }),
});

// Export TypeScript types inferred from the Zod schemas
// This gives you auto-completion in your Controller!
export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>['body'];
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>['body'];