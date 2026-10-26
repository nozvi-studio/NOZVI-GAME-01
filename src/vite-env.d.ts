/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Sentry DSN; unset (the default) means crash reports stay off. Put it in `.env.local`, never commit it. */
  readonly VITE_SENTRY_DSN?: string;
  /** GameAnalytics game key; with the secret key it turns GameAnalytics on in the native app. Put both in `.env.local`, never commit them. */
  readonly VITE_GA_GAME_KEY?: string;
  readonly VITE_GA_SECRET_KEY?: string;
}
