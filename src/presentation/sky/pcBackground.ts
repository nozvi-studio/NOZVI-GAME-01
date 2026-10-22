/**
 * Wide-screen backdrop: one painted nebula per chapter, shown in the margins around the
 * portrait game column. It is a DOM layer (`#pc-bg`) behind `#game`, not part of the canvas,
 * because the canvas is only as wide as the 9:16 column.
 */

/** Chapters that ship a background; anything else keeps the plain gradient. */
const PC_BACKGROUND_CHAPTERS = [1, 2, 3, 4, 5] as const;

/** Must match the media query on `#pc-bg` in style.css. */
export const PC_BACKGROUND_QUERY = '(min-aspect-ratio: 1/1) and (min-width: 900px)';

export function pcBackgroundUrl(chapter: number, base = '/'): string | null {
  if (!(PC_BACKGROUND_CHAPTERS as readonly number[]).includes(chapter)) return null;
  return `${base}assets/backgrounds/mirror-bg-pc-chuong-${chapter}.webp`;
}

/** Chapter number from a campaign level id such as `3-7`; null when it does not parse. */
export function chapterOfLevelId(levelId: string): number | null {
  const chapter = Number.parseInt(levelId.split('-')[0] ?? '', 10);
  return Number.isFinite(chapter) ? chapter : null;
}

let wanted: number | null = null;
let shownUrl: string | null = null;
let front = 0;
let mediaHooked = false;

function layers(): HTMLElement[] {
  const root = document.getElementById('pc-bg');
  return root ? Array.from(root.querySelectorAll<HTMLElement>('.pc-bg-layer')) : [];
}

function apply(): void {
  const els = layers();
  if (els.length < 2 || !window.matchMedia(PC_BACKGROUND_QUERY).matches) return;

  const url = wanted === null ? null : pcBackgroundUrl(wanted, import.meta.env.BASE_URL);
  if (url === shownUrl) return;

  const swap = (): void => {
    // A newer request may have landed while the image was loading.
    if ((wanted === null ? null : pcBackgroundUrl(wanted, import.meta.env.BASE_URL)) !== url) return;
    const next = els[1 - front]!;
    next.style.backgroundImage = url ? `url("${url}")` : '';
    next.classList.add('on');
    els[front]!.classList.remove('on');
    front = 1 - front;
    shownUrl = url;
  };

  if (!url) {
    swap();
    return;
  }
  // Decode first so the cross-fade never starts from an empty layer.
  const img = new Image();
  img.onload = swap;
  img.onerror = () => console.warn('[pcBackground] failed to load', url);
  img.src = url;
}

/** Choose the backdrop for a chapter; `null` or an unknown chapter falls back to the gradient. */
export function setPcBackground(chapter: number | null): void {
  wanted = chapter;
  if (!mediaHooked && typeof window !== 'undefined' && window.matchMedia) {
    mediaHooked = true;
    window.matchMedia(PC_BACKGROUND_QUERY).addEventListener('change', apply);
  }
  if (typeof document !== 'undefined') apply();
}
