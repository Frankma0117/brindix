import { db } from '../database/connection.js';

/** Tokens spent by the text model (SEO, words of the designs), for the cost log. */
export const aiUsageModel = {
  log(_userId: number, operation: string, model: string, inputTokens: number, outputTokens: number): void {
    db.prepare('INSERT INTO ai_usage (operation, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)').run(operation, model, inputTokens, outputTokens);
  },
};
