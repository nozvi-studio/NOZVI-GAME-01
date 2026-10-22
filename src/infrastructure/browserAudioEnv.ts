import type { MusicEnv } from './music.ts';
import type { SfxEnv } from './sfx.ts';

/** Real browser wiring for MusicPort. Not unit-tested: it is only DOM calls. */
export function browserMusicEnv(): MusicEnv {
  return {
    createElement: () => new Audio(),
    canPlayOgg: () => new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '',
    setInterval: (cb, ms) => window.setInterval(cb, ms),
    clearInterval: (id) => window.clearInterval(id),
    now: () => performance.now(),
    onFirstGesture: (cb) => {
      const once = () => {
        window.removeEventListener('pointerdown', once, true);
        window.removeEventListener('keydown', once, true);
        cb();
      };
      window.addEventListener('pointerdown', once, true);
      window.addEventListener('keydown', once, true);
    },
    onVisibilityChange: (cb) => {
      document.addEventListener('visibilitychange', () => cb(document.hidden));
    },
    warn: (msg) => console.warn(msg),
  };
}

/** Real browser wiring for SfxPort. Not unit-tested: it is only DOM calls. */
export function browserSfxEnv(): SfxEnv {
  return {
    now: () => performance.now(),
    setTimeout: (cb, ms) => window.setTimeout(cb, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    warn: (msg) => console.warn(msg),
  };
}
