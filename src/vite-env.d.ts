/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Sentry DSN; unset (the default) means crash reports stay off. Put it in `.env.local`, never commit it. */
  readonly VITE_SENTRY_DSN?: string;
}
