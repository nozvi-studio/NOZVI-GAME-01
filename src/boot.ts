import './boot.css';
import { createBootGate } from './boot/bootGate.ts';
import { resolveFontUrl } from './boot/fontUrl.ts';

/**
 * Loads the bundled Unbounded font faces for the portrait intro.
 * Uses resolveFontUrl to ensure paths resolve correctly under any base path.
 */
export async function loadIntroFonts(baseUrl = import.meta.env.BASE_URL): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  try {
    const f500 = new FontFace(
      'Unbounded',
      `url(${resolveFontUrl(baseUrl, 'fonts/unbounded-500.ttf')})`,
      { weight: '500', style: 'normal', display: 'block' }
    );
    const f800 = new FontFace(
      'Unbounded',
      `url(${resolveFontUrl(baseUrl, 'fonts/unbounded-800.ttf')})`,
      { weight: '800', style: 'normal', display: 'block' }
    );
    const [p1, p2] = await Promise.all([f500.load(), f800.load()]);
    document.fonts.add(p1);
    document.fonts.add(p2);
    await document.fonts.ready;
  } catch (err) {
    console.warn('[BOOT] Intro font load failed, falling back', err);
  }
}

function updateBootScale(): void {
  const scale = Math.min(window.innerWidth / 390, window.innerHeight / 844);
  document.documentElement.style.setProperty('--boot-scale', String(scale));
}

export function initBoot(): void {
  updateBootScale();
  window.addEventListener('resize', updateBootScale);

  void loadIntroFonts();

  const introEl = document.getElementById('intro');
  const errorBox = introEl?.querySelector('.intro-error') as HTMLElement | null;
  const retryBtn = introEl?.querySelector('.intro-retry-btn') as HTMLButtonElement | null;

  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get('scene');
  const skipSplashParam = params.get('skipSplash') === '1' || sceneParam === 'menu' || sceneParam === 'play' || sceneParam === 'levelSelect';
  const isDirectDev = Boolean(import.meta.env.DEV && skipSplashParam);

  const showLoading = (): void => {
    document.body.dataset.bootState = isDirectDev ? 'loading' : 'preparing';
  };

  const afterPaint = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  const loadGame = async (): Promise<void> => {
    if (errorBox) errorBox.hidden = true;

    const { startGame } = await import('./main.ts');

    await startGame({
      skipLoading: isDirectDev,
      onLoadingFrame: async () => {
        if (!isDirectDev && introEl) {
          introEl.classList.add('intro-exit');
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
          }
          introEl.style.display = 'none';
          await afterPaint();
        }
        document.body.dataset.bootState = isDirectDev ? 'ready' : 'loading';
      },
    });
  };

  const showError = (error: unknown, retry: () => void): void => {
    console.error('[BOOT] Failed to load game', error);
    if (errorBox) errorBox.hidden = false;
    if (retryBtn) {
      retryBtn.onclick = () => {
        retry();
      };
    }
  };

  const gate = createBootGate({
    showLoading,
    afterPaint,
    loadGame,
    showError,
  });

  if (isDirectDev) {
    if (introEl) introEl.style.display = 'none';
    void gate.enterLoading();
    return;
  }

  document.body.dataset.bootState = 'intro';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const holdMs = reduced ? 650 : 3500;

  const timer = window.setTimeout(() => {
    void gate.enterLoading();
  }, holdMs);

  introEl?.addEventListener(
    'pointerdown',
    () => {
      window.clearTimeout(timer);
      void gate.enterLoading();
    },
    { once: true }
  );
}

// Start boot immediately when script runs in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBoot());
  } else {
    initBoot();
  }
}
