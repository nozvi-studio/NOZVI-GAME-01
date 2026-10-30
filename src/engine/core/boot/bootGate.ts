export interface BootGateDeps {
  showLoading(): void;
  afterPaint(): Promise<void>;
  loadGame(): Promise<void>;
  showError(error: unknown, retry: () => void): void;
}

export interface BootGate {
  enterLoading(): Promise<void>;
  retry(): Promise<void>;
}

type BootStage = 'initial' | 'entering' | 'loading' | 'ready' | 'failed';

export function createBootGate(deps: BootGateDeps): BootGate {
  let stage: BootStage = 'initial';
  let inFlight: Promise<void> | null = null;

  const runLoad = async (): Promise<void> => {
    stage = 'loading';
    try {
      await deps.loadGame();
      stage = 'ready';
    } catch (error) {
      stage = 'failed';
      deps.showError(error, () => {
        void retry();
      });
    } finally {
      inFlight = null;
    }
  };

  const retry = async (): Promise<void> => {
    if (stage === 'ready' || inFlight) {
      return inFlight ?? Promise.resolve();
    }
    inFlight = runLoad();
    return inFlight;
  };

  const enterLoading = async (): Promise<void> => {
    if (stage !== 'initial') {
      return inFlight ?? Promise.resolve();
    }

    stage = 'entering';
    inFlight = (async () => {
      try {
        deps.showLoading();
        await deps.afterPaint();
        await runLoad();
      } catch (error) {
        stage = 'failed';
        deps.showError(error, () => {
          void retry();
        });
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };

  return {
    enterLoading,
    retry,
  };
}
