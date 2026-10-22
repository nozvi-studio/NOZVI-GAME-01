/** Trang HTML chọn chương và level cho bản thử endless; mở thẳng bằng file. */
export function renderGalleryPage(cards: string, count: number): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Endless lab</title>
<style>
body{font:14px system-ui;background:#111;color:#ddd;margin:16px}
header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
select,input,button{font:inherit;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:6px 10px}
button{background:#2b5fb4;border-color:#2b5fb4;cursor:pointer}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
figure{margin:0;background:#1b1b1b;padding:8px;border-radius:6px;cursor:pointer;border:2px solid transparent}
figure[hidden]{display:none}
figure:hover,figure:focus,figure.sel{border-color:#8cf;outline:none}
.svg svg{width:100%;height:auto;background:#000}
figcaption{margin-top:4px;font-size:12px}
.hint{color:#999;font-size:12px}
</style>
<header>
  <label>Chương <select id="chapter">
    <option value="1">Chương 1 (ghép cạnh)</option>
    <option value="2" disabled>Chương 2 (chưa có)</option>
    <option value="3" disabled>Chương 3 (chưa có)</option>
    <option value="4" disabled>Chương 4 (chưa có)</option>
  </select></label>
  <label>Màn <select id="level"></select></label>
  <button id="play">Chơi</button>
  <label>Dev server <input id="server" size="22" value="http://localhost:5174"></label>
</header>
<p class="hint">Bấm một màn để chọn, bấm đúp hoặc nút Chơi để mở trong game (harness). ${count} màn.</p>
<main id="grid">${cards}</main>
<script>
var $ = function (id) { return document.getElementById(id); };
var figs = Array.prototype.slice.call(document.querySelectorAll('figure'));
var KEY = 'endless-lab';
var saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
if (saved.server) $('server').value = saved.server;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ server: $('server').value, level: $('level').value })); } catch (e) {}
}
function visible() { return figs.filter(function (f) { return f.dataset.chapter === $('chapter').value; }); }
function mark() {
  figs.forEach(function (f) { f.classList.toggle('sel', f.dataset.level === $('level').value && !f.hidden); });
}
function fill() {
  $('level').innerHTML = '';
  figs.forEach(function (f) { f.hidden = f.dataset.chapter !== $('chapter').value; });
  visible().forEach(function (f) { $('level').add(new Option('Màn ' + f.dataset.level, f.dataset.level)); });
  if (saved.level && Array.prototype.some.call($('level').options, function (o) { return o.value === saved.level; })) {
    $('level').value = saved.level;
  }
  mark();
}
function play() {
  var f = visible().filter(function (x) { return x.dataset.level === $('level').value; })[0];
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
$('chapter').addEventListener('change', fill);
$('level').addEventListener('change', function () { mark(); save(); });
$('server').addEventListener('change', save);
$('play').addEventListener('click', play);
fill();
</script>`;
}
