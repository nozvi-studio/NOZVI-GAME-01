import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { campaignManifest } from '../../src/content/manifest.ts';
import { LEVEL_SOURCES } from '../../src/content/sources/index.ts';
import {
  deleteStudioLevel,
  listStudioLevels,
  saveStudioLevel,
} from '../../src/content/studioStore.ts';
import { promoteStudioLevel } from '../../src/content/promote.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

export type StudioHandlerOptions = {
  root?: string;
  manifestIds?: ReadonlySet<string>;
  sourceIds?: ReadonlySet<string>;
};

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

async function readBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<{ ok: true; body: string } | { ok: false; status: 413 }> {
  let text = '';
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      return { ok: false, status: 413 };
    }
    text += chunk.toString();
  }
  return { ok: true, body: text };
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Xử lý request tới các endpoint /__studio/ (spec E, ST-05, ST-06).
 * Trả về true nếu request được xử lý; false nếu không phải route của studio.
 */
export async function handleStudioRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: StudioHandlerOptions = {}
): Promise<boolean> {
  const url = req.url?.split('?')[0];
  if (!url || !url.startsWith('/__studio/')) {
    return false;
  }

  const root = options.root ?? DEFAULT_ROOT;
  const manifestIds =
    options.manifestIds ?? new Set(campaignManifest.map((m) => m.id));
  const sourceIds = options.sourceIds ?? new Set(Object.keys(LEVEL_SOURCES));

  // 1. GET /__studio/list
  if (req.method === 'GET' && url === '/__studio/list') {
    const list = listStudioLevels({ root });
    sendJson(res, 200, list);
    return true;
  }

  // Các phương thức thay đổi trạng thái (POST)
  if (req.method === 'POST') {
    // Chống CSRF 1: Bắt buộc Content-Type application/json (415)
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'unsupported-media-type' });
      return true;
    }

    // Chống CSRF 2: Origin phải khớp Host nếu có header Origin (403)
    const origin = req.headers['origin'];
    if (origin) {
      const host = req.headers['host'];
      const expectedHttp = `http://${host}`;
      const expectedHttps = `https://${host}`;
      if (origin !== expectedHttp && origin !== expectedHttps) {
        sendJson(res, 403, { ok: false, error: 'forbidden-origin' });
        return true;
      }
    }

    // Đọc body kèm giới hạn 1 MB (413)
    const bodyResult = await readBody(req, MAX_BODY_SIZE);
    if (!bodyResult.ok) {
      sendJson(res, 413, { ok: false, error: 'payload-too-large' });
      return true;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(bodyResult.body || '{}');
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid-json' });
      return true;
    }

    // 2. POST /__studio/save
    if (url === '/__studio/save') {
      const source = parsed?.source;
      if (!source) {
        sendJson(res, 400, { ok: false, error: 'missing-source' });
        return true;
      }

      const result = saveStudioLevel({
        source,
        root,
        manifestIds,
        sourceIds,
      });

      sendJson(res, result.ok ? 200 : result.status, result);
      return true;
    }

    // 3. POST /__studio/delete
    if (url === '/__studio/delete') {
      const id = parsed?.id;
      if (!id) {
        sendJson(res, 400, { ok: false, error: 'missing-id' });
        return true;
      }

      const result = deleteStudioLevel({ id, root });
      sendJson(res, result.ok ? 200 : result.status, result);
      return true;
    }

    // 4. POST /__studio/promote
    if (url === '/__studio/promote') {
      const studioId = typeof parsed?.studioId === 'string' ? parsed.studioId : '';
      const targetId = typeof parsed?.targetId === 'string' ? parsed.targetId : '';
      if (!studioId || !targetId) {
        sendJson(res, 400, { ok: false, error: 'thiếu studioId hoặc targetId' });
        return true;
      }
      const result = promoteStudioLevel({
        studioId,
        targetId,
        root,
        overwrite: parsed?.overwrite === true,
      });
      sendJson(res, 200, result);
      return true;
    }
  }

  return false;
}

/**
 * Plugin Vite gắn các endpoint dev của Xưởng màn (spec E, ST-05).
 * Chỉ chạy khi dev server (command === 'serve').
 */
export function studioPlugin(options: StudioHandlerOptions = {}): Plugin {
  return {
    name: 'mirror-studio-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleStudioRequest(req, res, options)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(next);
      });
    },
  };
}
