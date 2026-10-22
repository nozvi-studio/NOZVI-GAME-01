// Extract only the supplied vector artwork; UI and animation stay native Phaser.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const source = new URL('../../docs/gdd/assets/Bộ nhận diện năm thiên hà-html/GalaxyKit.dc.html', import.meta.url);
const html = readFileSync(source, 'utf8');
const art = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)]
  .map(m => m[0]).filter(svg => svg.includes('viewBox="0 0 350 350"'));
const output = new URL('../../public/assets/galaxies/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const [i, name] of ['dwarf', 'spiral'].entries()) {
  if (!art[i]) throw new Error(`Missing ${name} reference`);
  let extracted = art[i]
    .replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 350 350">')
    .replaceAll('x="-80%" y="-80%" width="260%" height="260%"', 'x="-200%" y="-200%" width="500%" height="500%"')
    .replace(/<rect width="350" height="350"[^>]*><\/rect>/, '');
  const save = (name, source) => {
    // Fade the square artboard boundary so overlapping chapter art has no seams.
    const svg = source.replace(/(<svg[^>]*>)/, '$1<defs><radialGradient id="edgeFade" gradientUnits="userSpaceOnUse" cx="175" cy="175" r="175"><stop offset="0.58" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient><mask id="artEdge" maskUnits="userSpaceOnUse" x="0" y="0" width="350" height="350"><rect width="350" height="350" fill="url(#edgeFade)"/></mask></defs><g mask="url(#artEdge)">').replace('</svg>', '</g></svg>');
    writeFileSync(new URL(`${name}.svg`, output), svg + '\n');
  };
  if (name === 'dwarf') {
    for (const layer of ['A', 'B']) {
      const cloud = extracted.match(new RegExp(`<g class="drift${layer}">[\\s\\S]*?</g>`))?.[0];
      if (!cloud) throw new Error(`Missing cloud ${layer}`);
      const head = extracted.match(/<svg[^>]*>/)[0];
      const defs = extracted.match(/<defs>[\s\S]*?<\/defs>/)[0];
      save(`dwarf-cloud${layer}`, `${head}${defs}${cloud}</svg>`);
      extracted = extracted.replace(cloud, '');
    }
  }
  save(name, extracted);
}

// ---- Layered artwork for the ring (kit III), cluster (IV) and prism (V) galaxies.
// The export always writes explicit close tags, so depth counting splits top-level nodes.
function topLevelNodes(inner) {
  const nodes = [];
  let depth = 0;
  let start = 0;
  for (const m of inner.matchAll(/<(\/?)([\w:-]+)[^>]*?(\/?)>/g)) {
    if (m[1]) depth--; else if (!m[3]) depth++;
    if (depth === 0) { nodes.push(inner.slice(start, m.index + m[0].length)); start = m.index + m[0].length; }
  }
  return nodes;
}
const classOf = node => node.match(/^<\w+[^>]*?\sclass="([^"]*)"/)?.[1] ?? '';
const EDGE = '<defs><radialGradient id="edgeFade" gradientUnits="userSpaceOnUse" cx="175" cy="175" r="175"><stop offset="0.58" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient><mask id="artEdge" maskUnits="userSpaceOnUse" x="0" y="0" width="350" height="350"><rect width="350" height="350" fill="url(#edgeFade)"/></mask></defs>';
const SMALL = 512; // thin or glowing layers need fewer pixels; this keeps texture memory down on phones
function layerWriter(svg) {
  const inner = svg.slice(svg.match(/<svg[^>]*>/)[0].length, svg.lastIndexOf('</svg>'))
    .replaceAll('x="-80%" y="-80%" width="260%" height="260%"', 'x="-200%" y="-200%" width="500%" height="500%"');
  const defs = inner.match(/<defs>[\s\S]*?<\/defs>/)[0];
  const body = topLevelNodes(inner.replace(defs, '')).filter(node => !/^<rect width="350" height="350"/.test(node));
  const write = (name, parts, size = 1024) => {
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 350 350">`;
    writeFileSync(new URL(`${name}.svg`, output), `${head}${EDGE}${defs}<g mask="url(#artEdge)">${parts.join('')}</g></svg>\n`);
  };
  return { body, write };
}
const need = (value, what) => { if (!value) throw new Error(`Missing ${what} in kit artwork`); return value; };
const chunks = (list, n) => Array.from({ length: n }, (_, i) => list.slice(Math.floor(i * list.length / n), Math.floor((i + 1) * list.length / n)));

{ // ring: static body + breathing core; the orbit streaks are drawn in code (galaxyMotion.ts)
  const { body, write } = layerWriter(art[2]);
  const orbit = /<ellipse[^>]*class="orbit2?"[^>]*><\/ellipse>/g;
  const core = /<circle[^>]*class="breath"[^>]*><\/circle>/;
  const joined = body.join('');
  write('ring', body.map(node => node.replace(orbit, '').replace(core, '')));
  write('ring-core', [need(joined.match(/<radialGradient id="g2rc"[\s\S]*?<\/radialGradient>/)?.[0], 'ring core gradient'), need(joined.match(core)?.[0], 'ring core')], SMALL);
}
{ // cluster: body, cosmic web, central giant, 20 mini-galaxies in 4 groups, 3 meteors
  const { body, write } = layerWriter(art[3]);
  const gradients = body.filter(node => /^<(radial|linear)Gradient/.test(node));
  const pops = body.filter(node => classOf(node).startsWith('pop'));
  const corePop = need(pops.find(node => /class="breath"/.test(node)), 'cluster core');
  const galaxies = pops.filter(node => node !== corePop);
  const web = need(body.find(node => classOf(node) === 'webp'), 'cluster web');
  const meteors = body.filter(node => classOf(node) === 'meteor');
  if (galaxies.length !== 20 || meteors.length !== 3) throw new Error(`Unexpected cluster artwork: ${galaxies.length} galaxies, ${meteors.length} meteors`);
  write('cluster', body.filter(node => ![...pops, ...meteors, web].includes(node)));
  write('cluster-web', [...gradients, web], SMALL);
  write('cluster-core', [...gradients, corePop], SMALL);
  chunks(galaxies, 4).forEach((part, i) => write(`cluster-galaxies-${i}`, [...gradients, ...part]));
  meteors.forEach((node, i) => write(`cluster-meteor-${i}`, [...gradients, node], SMALL));
}
{ // prism: body, incoming beam, rainbow fan, prism glass, 32 shards in 3 groups
  const { body, write } = layerWriter(art[4]);
  const beam = need(body.find(node => classOf(node) === 'beamIn'), 'prism beam');
  const fan = need(body.find(node => classOf(node) === 'fanIn'), 'prism fan');
  const glass = need(body.find(node => classOf(node).startsWith('in')), 'prism glass');
  const shards = body.filter(node => classOf(node).startsWith('pop'));
  if (shards.length !== 32) throw new Error(`Unexpected prism artwork: ${shards.length} shards`);
  write('prism', body.filter(node => ![beam, fan, glass, ...shards].includes(node)));
  write('prism-beam', [beam], SMALL);
  write('prism-fan', [fan], SMALL);
  write('prism-glass', [glass], SMALL);
  chunks(shards, 3).forEach((part, i) => write(`prism-shards-${i}`, part, SMALL));
}
