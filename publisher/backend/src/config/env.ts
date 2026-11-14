import { config as loadDotenv } from 'dotenv';
import { fromRoot } from './paths.js';

loadDotenv({ path: fromRoot('.env'), quiet: true });

/**
 * Everything the app reads from the environment, in one place. Each project that runs its own
 * copy of the publisher sets these in its own .env (see .env.example).
 */
const basePath = (process.env.BASE_PATH ?? '').trim().replace(/\/+$/, '').replace(/^(?!\/)(.+)$/, '/$1');

export const env = {
  port: Number(process.env.PORT ?? 3100),
  /** Embedded in a project's own panel: no password login, the project's ticket opens the session (see api/embed.ts). */
  embedded: process.env.EMBEDDED === 'true',
  embedSecret: process.env.EMBED_SECRET ?? '',
  /** Where the project's panel is, to send the administrator back when the session ends. */
  returnUrl: process.env.EMBED_RETURN_URL ?? '/',
  /** The whole app lives under this path (e.g. /publicador) so it can sit behind the project's nginx. */
  basePath,
  /** The project's software is told here when you validate or discard one of its videos (signed with EMBED_SECRET). Optional. */
  projectWebhookUrl: process.env.PROJECT_WEBHOOK_URL ?? '',
  /** Public address of THIS app (https): where the networks' login returns and where they download the media from. */
  panelUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  /** Name shown in the panel and in the notices («Brindix», «Cania»…). */
  projectName: process.env.PROJECT_NAME ?? 'Mi proyecto',
  ai: {
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    apiKey: process.env.AI_API_KEY ?? '',
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  },
  fal: { apiKey: process.env.FAL_KEY ?? '' },
  db: { path: fromRoot(process.env.DB_PATH ?? 'data/publisher.db') },
  /** S3-compatible storage (DigitalOcean Spaces). Without it the files stay on this server's disk. */
  spaces: {
    endpoint: process.env.DO_SPACES_ENDPOINT ?? '',
    region: process.env.DO_SPACES_REGION ?? '',
    bucket: process.env.DO_SPACES_BUCKET ?? '',
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY ?? '',
    prefix: process.env.DO_SPACES_PREFIX ?? 'publisher/',
  },
  /** The administrator's Canix (notices and approvals by WhatsApp). Optional. */
  canix: {
    url: (process.env.CANIX_URL ?? '').replace(/\/$/, ''),
    apiKey: process.env.CANIX_API_KEY ?? '',
    webhookSecret: process.env.CANIX_WEBHOOK_SECRET ?? '',
  },
};
