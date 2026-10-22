/** Điểm canvas hoặc điểm lưới; module này không quan tâm đơn vị. */
export type Pt = Readonly<{ x: number; y: number }>;

const AREA_EPSILON = 1e-6;

export function signedArea(polygon: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(polygon: readonly Pt[]): number {
  return Math.abs(signedArea(polygon));
}

function intersect(p: Pt, q: Pt, sp: number, sq: number): Pt {
  const t = sp / (sp - sq);
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

/**
 * Giao của đa giác `subject` với đa giác lồi `clip` (Sutherland–Hodgman).
 * Mọi hình của game đều lồi nên giao của chúng cũng lồi. Giao chỉ chạm cạnh
 * hay chạm đỉnh có diện tích 0 và được trả về rỗng.
 */
export function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  if (subject.length < 3 || clip.length < 3) return [];
  const orient = Math.sign(signedArea(clip)) || 1;
  let output: Pt[] = [...subject];

  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: Pt): number => orient * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const sc = side(cur);
      const sp = side(prev);
      if (sc >= 0) {
        if (sp < 0) output.push(intersect(prev, cur, sp, sc));
        output.push(cur);
      } else if (sp >= 0) {
        output.push(intersect(prev, cur, sp, sc));
      }
    }
  }

  return polygonArea(output) > AREA_EPSILON ? output : [];
}

export type ParityLayer = Readonly<{ points: Pt[]; depth: number; filled: boolean }>;

/**
 * Các lớp vẽ chồng cho luật chẵn/lẻ: mọi giao khác rỗng của k đa giác, xếp
 * theo k tăng dần. Vẽ lần lượt (lớp lẻ màu mảnh, lớp chẵn màu mặt bàn) thì
 * lớp trên cùng ở mỗi vùng là giao của đúng số mảnh đang phủ vùng đó, nên
 * màu luôn đúng tính chẵn lẻ của số ấy — với mọi số mảnh và mọi hình lồi.
 */
export function parityLayers(polygons: readonly (readonly Pt[])[]): ParityLayer[] {
  const layers: ParityLayer[] = [];
  // Mỗi phần tử là giao của một tập chỉ số tăng dần; `last` là chỉ số cuối
  // để chỉ ghép thêm đa giác có chỉ số lớn hơn (mỗi tập con xuất hiện một lần).
  let frontier = polygons
    .map((p, i) => ({ points: [...p], last: i }))
    .filter((f) => polygonArea(f.points) > AREA_EPSILON);
  let depth = 1;

  while (frontier.length > 0) {
    for (const f of frontier) {
      layers.push({ points: f.points, depth, filled: depth % 2 === 1 });
    }
    const next: Array<{ points: Pt[]; last: number }> = [];
    for (const f of frontier) {
      for (let j = f.last + 1; j < polygons.length; j++) {
        const inter = clipConvex(f.points, polygons[j]);
        if (inter.length >= 3) next.push({ points: inter, last: j });
      }
    }
    frontier = next;
    depth++;
  }

  return layers;
}

const UNION_EPS = 1e-6;

function samePoint(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < UNION_EPS && Math.abs(a.y - b.y) < UNION_EPS;
}

/**
 * Splits every edge at any input vertex that lies strictly inside it, so two
 * polygons sharing only part of an edge still produce matching halves that can
 * cancel against each other.
 */
function splitAtVertices(edges: Array<[Pt, Pt]>, vertices: readonly Pt[]): Array<[Pt, Pt]> {
  const out: Array<[Pt, Pt]> = [];
  for (const [a, b] of edges) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < UNION_EPS) continue;
    const along = (p: Pt) => (p.x - a.x) * dx + (p.y - a.y) * dy;
    const cuts: Pt[] = [];
    for (const v of vertices) {
      if (samePoint(v, a) || samePoint(v, b)) continue;
      const cross = (v.x - a.x) * dy - (v.y - a.y) * dx;
      if (Math.abs(cross) > UNION_EPS * Math.sqrt(len2)) continue;
      const t = along(v) / len2;
      if (t > UNION_EPS && t < 1 - UNION_EPS) cuts.push(v);
    }
    cuts.sort((p, q) => along(p) - along(q));
    let from = a;
    for (const cut of cuts) {
      if (!samePoint(from, cut)) out.push([from, cut]);
      from = cut;
    }
    if (!samePoint(from, b)) out.push([from, b]);
  }
  return out;
}

/** Drops vertices sitting on the straight line between their two neighbours. */
function dropCollinear(loop: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length];
    const cur = loop[i];
    const next = loop[(i + 1) % loop.length];
    const cross = (cur.x - prev.x) * (next.y - prev.y) - (cur.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > UNION_EPS) out.push(cur);
  }
  return out.length >= 3 ? out : [...loop];
}

/**
 * Boundary loops of the union of `polygons`.
 *
 * Every polygon is wound counter-clockwise, then every edge is split at any
 * vertex lying on it. An edge that then appears in both directions is interior
 * to the union and cancels; what survives is the boundary, chained into closed
 * loops and simplified across collinear runs.
 *
 * Used by the target silhouette: one dashed outline per placement strokes each
 * shared edge twice, which reads as a seam through the figure.
 */
export function unionOutline(polygons: readonly (readonly Pt[])[]): Pt[][] {
  const vertices: Pt[] = [];
  let edges: Array<[Pt, Pt]> = [];
  for (const polygon of polygons) {
    if (polygon.length < 3) continue;
    const ring = signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
    for (let i = 0; i < ring.length; i++) {
      vertices.push(ring[i]);
      edges.push([ring[i], ring[(i + 1) % ring.length]]);
    }
  }
  edges = splitAtVertices(edges, vertices);

  // Cancel each edge against one opposite twin.
  const alive = edges.map(() => true);
  for (let i = 0; i < edges.length; i++) {
    if (!alive[i]) continue;
    for (let j = i + 1; j < edges.length; j++) {
      if (!alive[j]) continue;
      if (samePoint(edges[i][0], edges[j][1]) && samePoint(edges[i][1], edges[j][0])) {
        alive[i] = false;
        alive[j] = false;
        break;
      }
    }
  }

  const remaining = edges.filter((_, i) => alive[i]);
  const used = remaining.map(() => false);
  const loops: Pt[][] = [];
  for (let i = 0; i < remaining.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const loop: Pt[] = [remaining[i][0]];
    let end = remaining[i][1];
    let guard = remaining.length + 1;
    while (!samePoint(end, loop[0]) && guard-- > 0) {
      const next = remaining.findIndex((e, k) => !used[k] && samePoint(e[0], end));
      if (next < 0) break;
      used[next] = true;
      loop.push(remaining[next][0]);
      end = remaining[next][1];
    }
    if (loop.length >= 3) loops.push(dropCollinear(loop));
  }
  return loops;
}

/** Where the open segments `a1-a2` and `b1-b2` cross, when the crossing lies strictly inside both. */
function crossingPoint(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < UNION_EPS) return null;
  const t = ((b1.x - a1.x) * sy - (b1.y - a1.y) * sx) / denom;
  const u = ((b1.x - a1.x) * ry - (b1.y - a1.y) * rx) / denom;
  if (t <= UNION_EPS || t >= 1 - UNION_EPS || u <= UNION_EPS || u >= 1 - UNION_EPS) return null;
  return { x: a1.x + rx * t, y: a1.y + ry * t };
}

/**
 * Outline of the region covered an odd number of times by `polygons` (the XOR figure),
 * as straight segments.
 *
 * Crossing parity flips across every polygon edge, so the outline is every edge, except
 * stretches where an even number of edges lie on top of each other: there the coverage
 * jumps by 2 and both sides share a parity, so nothing is lit on either side. Edges are
 * cut at every crossing and vertex first so partial overlaps line up, then runs that
 * continue straight are joined back into one segment (keeps dash patterns unbroken).
 */
export function parityOutline(polygons: readonly (readonly Pt[])[], outerOnly = false): Array<[Pt, Pt]> {
  const vertices: Pt[] = [];
  let edges: Array<[Pt, Pt]> = [];
  for (const polygon of polygons) {
    if (polygon.length < 3) continue;
    for (let i = 0; i < polygon.length; i++) {
      vertices.push(polygon[i]);
      edges.push([polygon[i], polygon[(i + 1) % polygon.length]]);
    }
  }
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const hit = crossingPoint(edges[i][0], edges[i][1], edges[j][0], edges[j][1]);
      if (hit) vertices.push(hit);
    }
  }
  edges = splitAtVertices(edges, vertices);

  // An edge laid on an odd number of times survives; pairs (either direction) cancel.
  const alive = edges.map(() => true);
  for (let i = 0; i < edges.length; i++) {
    if (!alive[i]) continue;
    for (let j = i + 1; j < edges.length; j++) {
      if (!alive[j]) continue;
      const same = samePoint(edges[i][0], edges[j][0]) && samePoint(edges[i][1], edges[j][1]);
      const opposite = samePoint(edges[i][0], edges[j][1]) && samePoint(edges[i][1], edges[j][0]);
      if (same || opposite) {
        alive[i] = false;
        alive[j] = false;
        break;
      }
    }
  }
  let segments = edges.filter((_, i) => alive[i]);

  // `outerOnly` keeps just the edges between lit area and the empty board. An edge with a covered
  // side on both sides, or with a removed (even-overlap) area on one side, is not drawn: it would
  // leave an edge around something that is gone. Edges are already cut at every
  // crossing, so a midpoint never sits on another polygon's boundary here.
  if (outerOnly) {
    const EPS = 0.05;
    const cover = (p: Pt) => polygons.filter((poly) => pointInLoop(p, poly)).length;
    segments = segments.filter(([a, b]) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < UNION_EPS) return false;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nx = (-(b.y - a.y) / len) * EPS;
      const ny = ((b.x - a.x) / len) * EPS;
      const c1 = cover({ x: mx + nx, y: my + ny });
      const c2 = cover({ x: mx - nx, y: my - ny });
      // Lit (odd) on one side, nothing at all on the other.
      return (c1 === 0 && c2 % 2 === 1) || (c2 === 0 && c1 % 2 === 1);
    });
  }

  // Join two segments that meet end to end on one straight line.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const [a, b] = segments[i];
        const [c, d] = segments[j];
        const pairs: Array<[Pt, Pt, Pt]> = []; // [far end of i, shared point, far end of j]
        if (samePoint(b, c)) pairs.push([a, b, d]);
        else if (samePoint(b, d)) pairs.push([a, b, c]);
        else if (samePoint(a, c)) pairs.push([b, a, d]);
        else if (samePoint(a, d)) pairs.push([b, a, c]);
        for (const [far1, mid, far2] of pairs) {
          const cross = (mid.x - far1.x) * (far2.y - mid.y) - (mid.y - far1.y) * (far2.x - mid.x);
          const dot = (mid.x - far1.x) * (far2.x - mid.x) + (mid.y - far1.y) * (far2.y - mid.y);
          if (Math.abs(cross) < UNION_EPS * 100 && dot > 0) {
            segments[i] = [far1, far2];
            segments.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
  }
  return segments;
}

/**
 * Exact odd-parity region of convex polygons as disjoint convex pieces (the
 * area covered by an odd number of polygons). Slices along every vertex height
 * so edges never cross inside a slab; within a slab the covering intervals are
 * ordered, and the spans between boundaries with odd cover are trapezoids.
 * Each point is covered by exactly one piece, so a translucent fill has the
 * same strength everywhere, overlaps included.
 */
export function oddRegions(polygons: readonly (readonly Pt[])[]): Pt[][] {
  const valid = polygons.filter((p) => p.length >= 3 && polygonArea(p) > AREA_EPSILON);
  const ys: number[] = [];
  for (const layer of parityLayers(valid)) for (const p of layer.points) ys.push(p.y);
  ys.sort((a, b) => a - b);
  const levels = ys.filter((y, i) => i === 0 || y - ys[i - 1] > UNION_EPS);

  // x of a convex polygon's boundary at height y, as [left, right]; null when y is outside it.
  const span = (poly: readonly Pt[], y: number): [number, number] | null => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (Math.abs(a.y - b.y) < UNION_EPS) {
        if (Math.abs(a.y - y) < UNION_EPS) {
          lo = Math.min(lo, a.x, b.x);
          hi = Math.max(hi, a.x, b.x);
        }
        continue;
      }
      if (y < Math.min(a.y, b.y) - UNION_EPS || y > Math.max(a.y, b.y) + UNION_EPS) continue;
      const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return hi >= lo ? [lo, hi] : null;
  };

  const out: Pt[][] = [];
  for (let s = 0; s + 1 < levels.length; s++) {
    const y0 = levels[s];
    const y1 = levels[s + 1];
    const mid = (y0 + y1) / 2;
    // Boundaries live in this slab: one pair of edges per polygon covering `mid`.
    const bounds: Array<{ xm: number; x0: number; x1: number; open: boolean }> = [];
    for (const poly of valid) {
      const m = span(poly, mid);
      if (!m || m[1] - m[0] < UNION_EPS) continue;
      const top = span(poly, y0 + (y1 - y0) * 1e-9);
      const bottom = span(poly, y1 - (y1 - y0) * 1e-9);
      if (!top || !bottom) continue;
      bounds.push({ xm: m[0], x0: top[0], x1: bottom[0], open: true });
      bounds.push({ xm: m[1], x0: top[1], x1: bottom[1], open: false });
    }
    bounds.sort((a, b) => a.xm - b.xm || (a.open === b.open ? 0 : a.open ? 1 : -1));
    let cover = 0;
    for (let i = 0; i + 1 < bounds.length; i++) {
      cover += bounds[i].open ? 1 : -1;
      if (cover % 2 === 0) continue;
      const l = bounds[i];
      const r = bounds[i + 1];
      const piece = [
        { x: l.x0, y: y0 },
        { x: r.x0, y: y0 },
        { x: r.x1, y: y1 },
        { x: l.x1, y: y1 },
      ];
      if (polygonArea(piece) > AREA_EPSILON) out.push(piece);
    }
  }
  return out;
}

/**
 * Chains the loose segments of `parityOutline` into polylines that follow the figure's edge,
 * one per closed loop, so a light can run along them. Where several segments meet at one point
 * any continuation is fine: every segment is used exactly once.
 */
export function outlineLoops(segments: ReadonlyArray<readonly [Pt, Pt]>): Pt[][] {
  const key = (p: Pt) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;
  const byPoint = new Map<string, number[]>();
  segments.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const list = byPoint.get(key(p)) ?? [];
      list.push(i);
      byPoint.set(key(p), list);
    }
  });
  const used = new Array<boolean>(segments.length).fill(false);
  const loops: Pt[][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const [first, second] = segments[i];
    const loop: Pt[] = [first];
    let at = second;
    while (key(at) !== key(first)) {
      loop.push(at);
      const next = (byPoint.get(key(at)) ?? []).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = true;
      const [a, b] = segments[next];
      at = key(a) === key(at) ? b : a;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

export function pointInLoop(p: Pt, loop: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export type OutlineChain = { points: Pt[]; closed: boolean };

/**
 * Like `outlineLoops`, but keeps chains that do not close (what is left when the edges around a
 * removed area are dropped) and says which is which, so a stroke never draws a chord across the
 * gap. Chains are grown both ways from their first segment.
 */
export function outlineChains(segments: ReadonlyArray<readonly [Pt, Pt]>): OutlineChain[] {
  const key = (p: Pt) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;
  const byPoint = new Map<string, number[]>();
  segments.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const list = byPoint.get(key(p)) ?? [];
      list.push(i);
      byPoint.set(key(p), list);
    }
  });
  const used = new Array<boolean>(segments.length).fill(false);
  const walk = (from: Pt, stopAt: string | null): { pts: Pt[]; hitStop: boolean } => {
    const pts: Pt[] = [];
    let at = from;
    for (;;) {
      const next = (byPoint.get(key(at)) ?? []).find((j) => !used[j]);
      if (next === undefined) return { pts, hitStop: false };
      used[next] = true;
      const [a, b] = segments[next];
      at = key(a) === key(at) ? b : a;
      pts.push(at);
      if (stopAt !== null && key(at) === stopAt) return { pts, hitStop: true };
    }
  };
  const chains: OutlineChain[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const [first, second] = segments[i];
    const forward = walk(second, key(first));
    if (forward.hitStop) {
      chains.push({ points: [first, second, ...forward.pts.slice(0, -1)], closed: true });
      continue;
    }
    const backward = walk(first, null);
    chains.push({ points: [...backward.pts.reverse(), first, second, ...forward.pts], closed: false });
  }
  return chains;
}
