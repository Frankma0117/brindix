/// <reference types="vite/client" />

/** Runtime settings the server injects into index.html (see backend/src/api/server.ts). */
interface Window {
  __APP__?: { base: string; embedded: boolean; returnUrl: string };
}
