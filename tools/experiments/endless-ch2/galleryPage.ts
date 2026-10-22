/** Trang HTML chọn level cho bản thử Endless Chương 2; mở thẳng bằng file. */
export function renderGalleryPage(cards: string, count: number): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Endless Chương 2 (Giao Thoa) - Phòng Thí Nghiệm</title>
<style>
body{font:14px system-ui,sans-serif;background:#080b14;color:#eef4fa;margin:16px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px;padding:12px;background:#101726;border-radius:8px;border:1px solid #1f2e4d}
select,input,button{font:inherit;background:#162033;color:#eef4fa;border:1px solid #2d4268;border-radius:6px;padding:6px 12px}
button{background:#d97724;border-color:#f59e0b;color:#fff;font-weight:600;cursor:pointer}
button:hover{background:#ea580c}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0;background:#0d1527;padding:10px;border-radius:8px;cursor:pointer;border:2px solid #1f2e4d;transition:border-color 0.15s}
figure:hover,figure:focus,figure.sel{border-color:#fbbf24;outline:none}
.svg svg{width:100%;height:auto;background:#05070e;border-radius:4px}
figcaption{margin-top:6px;font-size:12px;line-height:1.4}
.archetype{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#312e81;color:#a5b4fc;margin-bottom:4px}
.hint{color:#94a3b8;font-size:12px;margin-bottom:12px}
</style>
<header>
  <strong>MIRROR · Endless Chương II (Giao Thoa HSR)</strong>
  <label>Màn: <select id="level"></select></label>
  <button id="play">&#9658; Chơi trong Harness</button>
  <label>Dev server: <input id="server" size="22" value="http://localhost:5173"></label>
</header>
<p class="hint">Bấm một màn để chọn, bấm đúp hoặc nút "Chơi trong Harness" để mở trong game. Tổng cộng ${count} màn được sinh và chứng minh 1 nghiệm duy nhất.</p>
<main id="grid">${cards}</main>
<script>
var $ = function (id) { return document.getElementById(id); };
var figs = Array.prototype.slice.call(document.querySelectorAll('figure'));
var KEY = 'endless-ch2-lab';
var saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
if (saved.server) $('server').value = saved.server;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ server: $('server').value, level: $('level').value })); } catch (e) {}
}
function mark() {
  figs.forEach(function (f) { f.classList.toggle('sel', f.dataset.level === $('level').value); });
}
function fill() {
  $('level').innerHTML = '';
  figs.forEach(function (f) { $('level').add(new Option(f.dataset.title || ('Màn ' + f.dataset.level), f.dataset.level)); });
  if (saved.level && Array.prototype.some.call($('level').options, function (o) { return o.value === saved.level; })) {
    $('level').value = saved.level;
  }
  mark();
}
function play() {
  var f = figs.filter(function (x) { return x.dataset.level === $('level').value; })[0];
  if (!f) return;
  save();
  var base = $('server').value;
  if (base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
  window.open(base + '/?scene=play&level=' + f.dataset.id + '&mode=harness', '_blank');
}
figs.forEach(function (f) {
  f.addEventListener('click', function () { $('level').value = f.dataset.level; mark(); save(); });
  f.addEventListener('dblclick', play);
  f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { $('level').value = f.dataset.level; play(); } });
});
$('level').addEventListener('change', function () { mark(); save(); });
$('server').addEventListener('change', save);
$('play').addEventListener('click', play);
fill();
</script>`;
}
