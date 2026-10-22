export type CheckQueueOptions<TReq, TRes> = {
  delayMs?: number;
  run: (req: TReq, seq: number) => Promise<TRes> | void;
  onResult: (result: TRes, seq: number, isStale: boolean) => void;
};

export type CheckQueue<TReq> = {
  enqueue: (req: TReq) => number;
  isBusy: () => boolean;
  getLatestSeq: () => number;
  dispose: () => void;
};

/**
 * Hàng đợi kiểm tra lời giải (spec E, ST-04, Quyết định 4):
 * - Debounce 300 ms (mặc định) sau thao tác cuối
 * - Chỉ cho phép một lần giải tại một thời điểm
 * - Yêu cầu mới trong lúc đang giải được giữ lại (chỉ giữ bản mới nhất)
 * - Khi kết quả về, nếu seq < latestSeq thì đánh dấu isStale = true
 */
export function createCheckQueue<TReq, TRes>(
  opts: CheckQueueOptions<TReq, TRes>
): CheckQueue<TReq> {
  const delayMs = opts.delayMs ?? 300;
  let timer: any = null;
  let currentSeq = 0;
  let busy = false;
  let disposed = false;

  let latestReq: TReq | null = null;
  let latestSeq = 0;

  let pendingReq: TReq | null = null;
  let pendingSeq = 0;

  async function execute(req: TReq, seq: number) {
    if (disposed) return;
    busy = true;
    try {
      const result = await opts.run(req, seq);
      if (!disposed && result !== undefined) {
        opts.onResult(result, seq, seq < latestSeq);
      }
    } catch (err) {
      if (!disposed) {
        // Có thể ném lỗi hoặc báo qua onResult nếu hỗ trợ
        console.error(`[checkQueue] Lỗi khi giải seq ${seq}:`, err);
      }
    } finally {
      busy = false;
      if (!disposed && pendingReq !== null) {
        const nextReq = pendingReq;
        const nextSeq = pendingSeq;
        pendingReq = null;
        pendingSeq = 0;
        // Thực thi ngay yêu cầu kế tiếp trong microtask
        queueMicrotask(() => {
          void execute(nextReq, nextSeq);
        });
      }
    }
  }

  function schedule() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    timer = setTimeout(() => {
      timer = null;
      if (disposed || latestReq === null) return;

      if (busy) {
        pendingReq = latestReq;
        pendingSeq = latestSeq;
      } else {
        const req = latestReq;
        const seq = latestSeq;
        void execute(req, seq);
      }
    }, delayMs);
  }

  return {
    enqueue(req: TReq): number {
      currentSeq++;
      latestSeq = currentSeq;
      latestReq = req;
      schedule();
      return latestSeq;
    },

    isBusy(): boolean {
      return busy;
    },

    getLatestSeq(): number {
      return latestSeq;
    },

    dispose() {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      latestReq = null;
      pendingReq = null;
    },
  };
}
