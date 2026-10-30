/**
 * Locale state shared by every game: which locale is active, who hears about a change, and the
 * bundle lookup with a fallback. What a bundle contains, and how the first locale is chosen at
 * boot, is the game's business.
 */
export class Localization<L extends string, B> {
  private readonly bundles: Readonly<Record<L, B>>;
  private readonly fallback: L;
  private readonly persist: (locale: L) => void;
  private readonly listeners = new Set<(locale: L) => void>();
  private current: L;

  constructor(bundles: Readonly<Record<L, B>>, fallback: L, initial: L, persist: (locale: L) => void = () => {}) {
    this.bundles = bundles;
    this.fallback = fallback;
    this.persist = persist;
    this.current = initial;
  }

  get locale(): L {
    return this.current;
  }

  /** The bundle of `locale`, or of the fallback locale when `locale` has none. */
  bundle(locale: L = this.current): B {
    return this.bundles[locale] ?? this.bundles[this.fallback];
  }

  isSupported(locale: string): locale is L {
    return Object.prototype.hasOwnProperty.call(this.bundles, locale);
  }

  /** Switches locale. False, and silent, when `locale` is unknown or already active. */
  set(locale: L): boolean {
    if (!this.isSupported(locale) || locale === this.current) return false;
    this.current = locale;
    this.persist(locale);
    this.listeners.forEach((listener) => listener(locale));
    return true;
  }

  onChange(listener: (locale: L) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Replaces every `{name}` in `text` with the matching entry of `params`. */
export function interpolate(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return text;
  let out = text;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return out;
}
