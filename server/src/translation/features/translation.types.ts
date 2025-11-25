export interface TranslationJobData {
  jobId: string;
  userId: string;
  s3Key: string;     // "uploads/user_123/file.srt"
  targetLang: string;
  modelId: string;   // "gemini-1.5-flash"
}

export interface TranslationJobResult {
  translatedFileKey: string;
}