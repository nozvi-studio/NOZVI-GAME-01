import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { LevelSource } from '../src/content/authoring.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { handleStudioRequest } from '../scripts/studio/studioPlugin.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function createMockReq(opts: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): any {
  const stream = new Readable({
    read() {
      if (opts.body !== undefined) {
        this.push(Buffer.from(opts.body));
      }
      this.push(null);
    },
  });
  (stream as any).method = opts.method;
  (stream as any).url = opts.url;
  (stream as any).headers = opts.headers ?? {};
  return stream;
}

function createMockRes(): any {
  const headers: Record<string, string> = {};
  let body = '';
  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(data?: string | Buffer) {
      if (data) body += data.toString();
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    getBody() {
      return body;
    },
    getJson() {
      return body ? JSON.parse(body) : null;
    },
  };
}

describe('studioPlugin - HTTP endpoints và chống CSRF', () => {
  const tempRoot = resolve(tmpdir(), `mirror-studio-plugin-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tempRoot, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('bỏ qua request không thuộc /__studio/', async () => {
    const req = createMockReq({ method: 'GET', url: '/index.html' });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(false);
  });

  test('POST không có Content-Type: application/json trả về 415', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/save',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(415);
    expect(res.getJson().error).toBe('unsupported-media-type');
  });

  test('POST có Origin sai lệch so với Host trả về 403', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/save',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://malicious-site.com',
      },
      body: '{}',
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.getJson().error).toBe('forbidden-origin');
  });

  test('POST body vượt quá 1 MB trả về 413', async () => {
    const hugeBody = JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 10) });
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/save',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      },
      body: hugeBody,
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(413);
    expect(res.getJson().error).toBe('payload-too-large');
  });

  test('POST /__studio/save lưu thành công trả về 200', async () => {
    const source: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: 'plugin-test-1',
      title: 'Plugin Test 1',
    };
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/save',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ source }),
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, {
      root: tempRoot,
      manifestIds: new Set(['1-1']),
      sourceIds: new Set(['1-1']),
    });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.getJson();
    expect(json.ok).toBe(true);
    expect(json.files).toHaveLength(4);
  });

  test('POST /__studio/save từ chối id trùng campaign với 409', async () => {
    const source: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: '1-1',
    };
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/save',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
      },
      body: JSON.stringify({ source }),
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, {
      root: tempRoot,
      manifestIds: new Set(['1-1']),
      sourceIds: new Set(['1-1']),
    });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(409);
    expect(res.getJson().error).toBe('id-clash-campaign');
  });

  test('GET /__studio/list trả về danh sách 200', async () => {
    const req = createMockReq({
      method: 'GET',
      url: '/__studio/list',
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const list = res.getJson();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((l: any) => l.id === 'plugin-test-1')).toBe(true);
  });

  test('POST /__studio/delete xoá thành công trả về 200', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/delete',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
      },
      body: JSON.stringify({ id: 'plugin-test-1' }),
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.getJson();
    expect(json.ok).toBe(true);
    expect(json.deletedFiles).toHaveLength(4);
  });

  test('POST /__studio/promote từ chối body thiếu targetId', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/promote',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
      },
      body: JSON.stringify({ studioId: 'nhap' }),
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
  });

  test('POST /__studio/promote chuyển tiếp lỗi của promoteStudioLevel nguyên văn', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/__studio/promote',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:5173',
      },
      body: JSON.stringify({ studioId: 'khong-co', targetId: '1-4', overwrite: true }),
    });
    const res = createMockRes();
    const handled = await handleStudioRequest(req, res, { root: tempRoot });
    expect(handled).toBe(true);
    const body = res.getJson();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('studio-not-found');
  });
});
