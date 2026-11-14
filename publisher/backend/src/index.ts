import { env } from './config/env.js';
import { adminPassword } from './api/auth.js';
import { createServer } from './api/server.js';
import { initSchema } from './database/migrate.js';
import { createCanixHost } from './services/publisher/canix-client.js';
import { setPublisherHost, type PublisherHost } from './services/publisher/automation/automation.host.js';
import { startPublisherJob } from './services/publisher/publisher-job.js';

/**
 * Publisher: one copy per project, with its own database, brand, accounts and keys.
 * Notices and approvals go to the administrator's WhatsApp through Canix when CANIX_* are set.
 */
function buildHost(): PublisherHost {
  if (env.canix.url && env.canix.apiKey) return createCanixHost({ url: env.canix.url, apiKey: env.canix.apiKey, adminId: () => 1 });
  console.log('[HOST] Without CANIX_URL / CANIX_API_KEY the notices only go to this log and approvals are done in the panel.');
  return {
    adminId: () => 1,
    notify: async (text) => {
      console.log('[NOTICE]', text.replace(/\n/g, ' · '));
      return null;
    },
  };
}

console.log('=== Publicador · %s ===', env.projectName);
initSchema();
adminPassword(); // creates the password file the first time, if none is set
setPublisherHost(buildHost());
startPublisherJob();
createServer().listen(env.port, () => console.log('[API] Panel at http://localhost:%d', env.port));
