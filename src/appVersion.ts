/** The version in package.json, injected by Vite (`define` in vite.config.ts); one source for every screen. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
