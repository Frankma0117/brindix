import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { db } from './connection.js';
import { initAppSchema } from './schema/app.schema.js';
import { initPublisherSchema } from './schema/publisher.schema.js';

/** Creates every table that doesn't exist yet. Idempotent: runs at every boot and standalone with `npm run db:migrate`. */
export function initSchema(): void {
  initAppSchema(db);
  initPublisherSchema(db);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  initSchema();
  console.log('[DB] Schema ready.');
}
