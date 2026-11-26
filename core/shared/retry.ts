import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  contextName: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = () => true, // Retry on all errors by default, unless customized
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      
      if (attempt > maxRetries || !shouldRetry(error)) {
        logger.error(`Operation [${contextName}] failed after ${attempt} attempts`, error);
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = delay * 0.1 * Math.random(); 
      const totalDelay = delay + jitter;

      logger.warn(`Operation [${contextName}] failed (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(totalDelay)}ms`, { error: error instanceof Error ? error.message : String(error) });
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}
