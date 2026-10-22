import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9225;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--window-size=1440,900',
  '--user-data-dir=' + process.env.TEMP + '\\chrome_test_profile_' + Date.now(),
  'about:blank',
], { stdio: 'ignore' });

async function run() {
  await new Promise(r => setTimeout(r, 1000));

  const targetUrl = 'http://127.0.0.1:5173/tools/studio.html#1-4';
  const versionRes = await fetch(`http://127.0.0.1:${port}/json/new?${targetUrl}`, { method: 'PUT' });
  const target = await versionRes.json();
  const wsUrl = target.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const res = pending.get(msg.id);
      pending.delete(msg.id);
      res(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', JSON.stringify(msg.params.exceptionDetails));
    }
  };

  await new Promise(r => { ws.onopen = r; });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: targetUrl });

  // Wait 3 seconds for scripts and solves
  await new Promise(r => setTimeout(r, 3000));

  const appLen = await send('Runtime.evaluate', { expression: 'document.getElementById("app")?.innerHTML.length' });
  console.log('App innerHTML length:', appLen);

  // Take screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const buf = Buffer.from(shot.data, 'base64');
    writeFileSync('D:\\Working\\ASOL\\ASOL-GAME-02\\docs\\testing\\studio\\acceptance.png', buf);
    writeFileSync('D:\\Working\\ASOL\\ASOL-GAME-02\\docs\\testing\\studio\\inspector.png', buf);
    console.log('Saved docs/testing/studio/acceptance.png and inspector.png');
  } else {
    console.error('Failed to capture screenshot:', shot);
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
