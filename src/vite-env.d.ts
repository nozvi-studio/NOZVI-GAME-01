/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Sentry DSN; unset (the default) means crash reports stay off. Put it in `.env.local`, never commit it. */
  readonly VITE_SENTRY_DSN?: string;
  /** `true` lets the dev server send crash reports too (to try Sentry with `__crashTest`); off by default. */
  readonly VITE_SENTRY_DEV?: string;
  /** GameAnalytics game key; with the secret key it turns GameAnalytics on in the native app. Put both in `.env.local`, never commit them. */
  readonly VITE_GA_GAME_KEY?: string;
  readonly VITE_GA_SECRET_KEY?: string;
  /** Public URL of the Privacy Policy; the consent screen and Privacy dialog link to it. Hidden when unset. */
  readonly VITE_PRIVACY_POLICY_URL?: string;
}
