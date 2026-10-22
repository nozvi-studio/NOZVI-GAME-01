import { levelTemplate } from '../content/sources/_template.ts';
import { sourceFromDocument } from '../content/sourceFromDocument.ts';
import type { AuthorResult } from '../content/authorLevel.ts';
import { createCheckQueue } from './checkQueue.ts';
import { keyToAction } from './keys.ts';
import { createInitialState, isDirty, studioReducer } from './state.ts';
import type { StudioAction, StudioState } from './state.ts';
import { fetchStudioLevelDoc } from './api.ts';
import { createBoardView } from './boardView.ts';
import { createPalette } from './palette.ts';
import { createLibrary } from './library.ts';
import { createInspector } from './inspector.ts';
import { handleCheck } from './solverWorker.ts';

function initStudio() {
  const root = document.getElementById('app');
  if (!root) return;

  root.style.display = 'flex';
  root.style.width = '100vw';
  root.style.height = '100vh';
  root.style.overflow = 'hidden';
  root.style.backgroundColor = '#070a14';
  root.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  let state: StudioState = createInitialState(levelTemplate);

  // Middle layout column (Palette on top, Board in center)
  const centerCol = document.createElement('div');
  centerCol.style.flex = '1';
  centerCol.style.display = 'flex';
  centerCol.style.flexDirection = 'column';
  centerCol.style.height = '100%';
  centerCol.style.overflow = 'hidden';

  const getState = () => state;

  const dispatch = (action: StudioAction) => {
    state = studioReducer(state, action);
    renderAll();
    checkQueue.enqueue(state.source);
  };

  // 1. Library (Left)
  const library = createLibrary({
    getState,
    dispatch,
    onSelectLevel: (id) => {
      window.location.hash = `#${id}`;
    },
  });

  // 2. Palette (Center Top)
  const palette = createPalette({
    getState,
    dispatch,
  });

  // 3. Board (Center Middle)
  const boardView = createBoardView({
    getState,
    dispatch,
  });

  centerCol.appendChild(palette.element);
  const boardScroll = document.createElement('div');
  boardScroll.style.flex = '1';
  boardScroll.style.overflow = 'auto';
  boardScroll.style.display = 'flex';
  boardScroll.style.justifyContent = 'center';
  boardScroll.style.alignItems = 'center';
  boardScroll.appendChild(boardView.element);
  centerCol.appendChild(boardScroll);

  // 4. Inspector (Right)
  const inspector = createInspector({
    getState,
    dispatch,
    onSaved: () => {
      void library.refresh();
      renderAll();
    },
  });

  root.appendChild(library.element);
  root.appendChild(centerCol);
  root.appendChild(inspector.element);

  function renderAll() {
    palette.render();
    boardView.render();
    library.render();
    inspector.render();
  }

  // Initial render & load library
  renderAll();
  void library.refresh();

  // Web Worker & Check Queue
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' });
  } catch (err) {
    console.warn('[studio] Web Worker không khởi tạo được, dùng fallback:', err);
  }

  const checkQueue = createCheckQueue<any, AuthorResult>({
    delayMs: 300,
    run: (src, seq) => {
      return new Promise<AuthorResult>((resolve) => {
        if (worker) {
          const handler = (e: MessageEvent) => {
            if (e.data.seq === seq) {
              worker?.removeEventListener('message', handler);
              resolve(e.data.result);
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ seq, source: src });
        } else {
          // Fallback direct run in next tick
          setTimeout(() => {
            resolve(handleCheck(src));
          }, 0);
        }
      });
    },
    onResult: (result, _seq, isStale) => {
      if (!isStale) {
        inspector.setCheckResult(result, false);
      }
    },
  });

  // Initial solve run
  checkQueue.enqueue(state.source);

  // Keyboard shortcut listener
  window.addEventListener('keydown', (e) => {
    const action = keyToAction(e, state);
    if (action) {
      e.preventDefault();
      dispatch(action);
    }
  });

  // Warn before unload if dirty
  window.addEventListener('beforeunload', (e) => {
    if (isDirty(state)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Hash loader
  async function loadFromHash() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || hash === state.source.id) return;
    try {
      const doc = await fetchStudioLevelDoc(hash);
      const src = sourceFromDocument(doc);
      state = createInitialState(src);
      renderAll();
      checkQueue.enqueue(state.source);
    } catch {
      // If not in studio, check if in campaign
      try {
        const res = await fetch(`/src/content/levels/${hash}.json`);
        if (res.ok) {
          const doc = await res.json();
          const src = sourceFromDocument(doc);
          state = createInitialState(src);
          renderAll();
          checkQueue.enqueue(state.source);
        }
      } catch {
        // ignore
      }
    }
  }

  window.addEventListener('hashchange', () => {
    void loadFromHash();
  });

  void loadFromHash();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initStudio);
} else {
  initStudio();
}
