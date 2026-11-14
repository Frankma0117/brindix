/** Where the app lives (BASE_PATH) and whether it is embedded in a project's panel: injected by the server. */
export const APP = {
  base: window.__APP__?.base ?? '',
  embedded: window.__APP__?.embedded ?? false,
  returnUrl: window.__APP__?.returnUrl ?? '/',
};
/** An address of this app, with the base path in front. */
export const url = (path: string) => (path.startsWith('/') ? APP.base + path : path);
