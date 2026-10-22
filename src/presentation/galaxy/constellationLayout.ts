import type { Chapter } from '../../domain/model.ts';

export type MapEntry = { id: string; title: string; chapter: Chapter };
export type MapNode = MapEntry & { index: number; x: number; y: number };
export type ChapterBand = {
  chapter: Chapter;
  /** Tâm dòng tiêu đề chương */
  bannerY: number;
  /** Dải màu nền của chương: [top, bottom) */
  top: number;
  bottom: number;
  nodeCount: number;
  /** Explicit artwork spots when the layout winds the path around them. */
  art?: BandArt[];
};
export type CampaignMapLayout = { nodes: MapNode[]; chapters: ChapterBand[]; totalHeight: number };

const FIRST_NODE_Y = 270;
const NODE_STEP_Y = 160;
const CHAPTER_GAP_Y = 100;
const BANNER_OFFSET_Y = 85;
const BAND_OFFSET_Y = 170;
const BOTTOM_PADDING = 240;
/** Room reserved for a themed chapter that has no levels yet (banner plus its galaxy artwork). */
const TEASER_SPAN_Y = 1000;

/**
 * Long chapter 2 winds around one spiral galaxy per ~6 levels. The path hugs
 * each core on a C-shaped arc (open side facing the screen centre) and always
 * descends, so the badge under the current node never covers the next one.
 */
const COIL_RADIUS = 390;
const COIL_PITCH_Y = 980;
const COIL_LEFT_CX = 520;
const COIL_RIGHT_CX = 200;
const COIL_ART_SIZE = 1500;
/** Cool blue, warm amber, teal, magenta: each repeat gets its own colour, tilt and spin. */
const COIL_LOOKS: readonly GalaxyLook[] = [
  { angle: 0, scaleY: 1, spin: 1 },
  { tint: 0x8fcfff, angle: -24, scaleY: 0.86, spin: -1 },
  { tint: 0xffc48f, angle: 18, scaleY: 0.92, spin: 1 },
  { tint: 0x9affd6, angle: -38, scaleY: 0.84, spin: -1 },
  { tint: 0xff9ad2, angle: 30, scaleY: 0.9, spin: 1 },
];
const COIL_MAX_NODES = 6;
const COIL_MIN_ENTRIES = 12;

/**
 * Chòm sao 10 nút (chương 3): chuỗi đèn lồng — một nút giữa, một cặp hai
 * bên, lặp lại. [x tuyệt đối, dy so với nút đầu chương]. Cặp cùng hàng cách
 * nhau 360px (> huy hiệu 260px); các hàng cách nhau 200px.
 */
export const TEN_NODE_PATTERN: ReadonlyArray<readonly [number, number]> = [
  [360, 0],
  [180, 200],
  [540, 200],
  [360, 400],
  [180, 600],
  [540, 600],
  [360, 800],
  [180, 1000],
  [540, 1000],
  [360, 1200],
];

/**
 * Chương 3 (Luân Chuyển) cuộn quanh các thiên hà vòng nhẫn: nút nằm ngay trên
 * nửa trái hoặc nửa phải của vòng sáng, xen kẽ từng vòng nên đường đi uốn
 * xuống như rắn và luôn đi xuống. Bán trục RX×RY là của ảnh nền (không phụ
 * thuộc cỡ ảnh, xem `addGalaxyArtwork`); 5 nút mỗi vòng cách nhau ≥ 187px.
 */
const RING_RX = 295;
const RING_RY = 375;
/** Hai vòng liền nhau cách nhau 170px giữa mép dưới vòng trên và mép trên vòng dưới. */
const RING_PITCH_Y = 920;
/** Tâm vòng khi nút nằm bên trái / bên phải vòng. */
const RING_LEFT_CX = 500;
const RING_RIGHT_CX = 220;
const RING_ART_SIZE = 1050;
const RING_MAX_NODES = 5;
const RING_MIN_ENTRIES = 10;

/** Zigzag cũ của bản đồ 18 màn, theo chỉ số toàn cục: x trong [191, 529]. */
function zigzagX(index: number): number {
  const dir = index % 2 === 0 ? -1 : 1;
  return 360 + dir * (135 + ((index * 43) % 35));
}

/**
 * Toạ độ nút và dải chương suy ra từ manifest: mỗi nhóm chương liền nhau là
 * một chòm sao. Chòm sao đúng 10 nút dùng TEN_NODE_PATTERN, còn lại zigzag.
 */
export function layoutCampaignMap(entries: readonly MapEntry[], teaserChapters: readonly Chapter[] = []): CampaignMapLayout {
  const groups: Array<{ chapter: Chapter; entries: MapEntry[] }> = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.chapter === entry.chapter) last.entries.push(entry);
    else groups.push({ chapter: entry.chapter, entries: [entry] });
  }

  // Chương có màn và chương chỉ có tiêu đề (teaser) xếp chung theo số chương,
  // để chương khóa nằm đúng chỗ giữa các chương khác.
  type Segment = { chapter: Chapter; entries: MapEntry[] | null };
  const segments: Segment[] = [
    ...groups.map((g): Segment => ({ chapter: g.chapter, entries: g.entries })),
    ...teaserChapters.filter((c) => !groups.some((g) => g.chapter === c)).map((c): Segment => ({ chapter: c, entries: null })),
  ].sort((x, y) => x.chapter - y.chapter);

  const nodes: MapNode[] = [];
  let coilArt: BandArt[] | undefined;
  let ringArt: BandArt[] | undefined;
  const bands: Array<Omit<ChapterBand, 'bottom'>> = [];
  let cursorY = FIRST_NODE_Y;
  let lastWasTeaser = false;
  segments.forEach((group, g) => {
    if (g > 0) cursorY += CHAPTER_GAP_Y;
    const firstY = cursorY;
    if (group.entries === null) {
      // Chương chưa có màn: tiêu đề và chỗ cho hình thiên hà, không có nút.
      bands.push({
        chapter: group.chapter,
        bannerY: firstY - BANNER_OFFSET_Y,
        top: g === 0 ? 0 : firstY - BAND_OFFSET_Y,
        nodeCount: 0,
      });
      cursorY = firstY + TEASER_SPAN_Y;
      lastWasTeaser = true;
      return;
    }
    lastWasTeaser = false;
    if (group.chapter === 2 && group.entries.length === 6) {
      // An open spiral: descend along the outer arm, then turn toward the core.
      const spiral = [[300, 0], [155, 200], [135, 440], [260, 660], [550, 660], [440, 370]];
      group.entries.forEach((entry, i) => {
        const [x, dy] = spiral[i];
        nodes.push({ ...entry, index: nodes.length, x, y: firstY + dy });
      });
      // Reserve the whole chapter footprint, not the inner endpoint's height.
      cursorY = firstY + group.entries.length * NODE_STEP_Y;
    } else if (group.chapter === 2 && group.entries.length >= COIL_MIN_ENTRIES) {
      const galaxies = Math.ceil(group.entries.length / COIL_MAX_NODES);
      const base = Math.floor(group.entries.length / galaxies);
      const extra = group.entries.length % galaxies;
      coilArt = [];
      let next = 0;
      for (let gi = 0; gi < galaxies; gi++) {
        const count = base + (gi < extra ? 1 : 0);
        const onLeft = gi % 2 === 0;
        const cx = onLeft ? COIL_LEFT_CX : COIL_RIGHT_CX;
        const cy = firstY + COIL_RADIUS + gi * COIL_PITCH_Y;
        coilArt.push({ x: cx, y: cy, size: COIL_ART_SIZE, look: COIL_LOOKS[gi % COIL_LOOKS.length] });
        for (let k = 0; k < count; k++, next++) {
          const dy = -COIL_RADIUS + (k * 2 * COIL_RADIUS) / (count - 1);
          const dx = Math.sqrt(COIL_RADIUS ** 2 - dy ** 2);
          nodes.push({ ...group.entries[next], index: nodes.length, x: Math.round(cx + (onLeft ? -dx : dx)), y: Math.round(cy + dy) });
        }
      }
      cursorY = nodes[nodes.length - 1].y + NODE_STEP_Y;
    } else if (group.chapter === 3 && group.entries.length >= RING_MIN_ENTRIES) {
      const rings = Math.ceil(group.entries.length / RING_MAX_NODES);
      const base = Math.floor(group.entries.length / rings);
      const extra = group.entries.length % rings;
      ringArt = [];
      let next = 0;
      for (let ri = 0; ri < rings; ri++) {
        const count = base + (ri < extra ? 1 : 0);
        const onLeft = ri % 2 === 0;
        const cx = onLeft ? RING_LEFT_CX : RING_RIGHT_CX;
        const cy = firstY + RING_RY + ri * RING_PITCH_Y;
        ringArt.push({ x: cx, y: cy, size: RING_ART_SIZE });
        for (let k = 0; k < count; k++, next++) {
          // Even steps in y (as chapter 2's coil), x follows the ellipse.
          const dy = count === 1 ? 0 : -RING_RY + (k * 2 * RING_RY) / (count - 1);
          const dx = RING_RX * Math.sqrt(Math.max(0, 1 - (dy / RING_RY) ** 2));
          nodes.push({ ...group.entries[next], index: nodes.length, x: Math.round(cx + (onLeft ? -dx : dx)), y: Math.round(cy + dy) });
        }
      }
      cursorY = nodes[nodes.length - 1].y + NODE_STEP_Y;
    } else if (group.entries.length === TEN_NODE_PATTERN.length) {
      group.entries.forEach((entry, i) => {
        const [x, dy] = TEN_NODE_PATTERN[i];
        nodes.push({ ...entry, index: nodes.length, x, y: firstY + dy });
      });
      cursorY = firstY + TEN_NODE_PATTERN[TEN_NODE_PATTERN.length - 1][1] + NODE_STEP_Y;
    } else {
      for (const entry of group.entries) {
        const index = nodes.length;
        nodes.push({ ...entry, index, x: zigzagX(index), y: cursorY });
        cursorY += NODE_STEP_Y;
      }
    }
    bands.push({
      chapter: group.chapter,
      bannerY: firstY - BANNER_OFFSET_Y,
      top: g === 0 ? 0 : firstY - BAND_OFFSET_Y,
      nodeCount: group.entries.length,
      ...(group.chapter === 2 && coilArt ? { art: coilArt } : {}),
      ...(group.chapter === 3 && ringArt ? { art: ringArt } : {}),
    });
  });

  const totalHeight = lastWasTeaser ? cursorY : (nodes.length > 0 ? nodes[nodes.length - 1].y + BOTTOM_PADDING : FIRST_NODE_Y);
  const chapters: ChapterBand[] = bands.map((band, i) => ({
    ...band,
    bottom: i + 1 < bands.length ? bands[i + 1].top : totalHeight,
  }));
  return { nodes, chapters, totalHeight };
}

/** How one repeat of a galaxy differs from its neighbours, so no two read as a copy. */
export type GalaxyLook = { tint?: number; angle: number; scaleY: number; spin: 1 | -1 };
/** Midpoint of the gap between the two node rows around `y`, so a title card sits between levels; `y` itself outside the rows. */
export function snapToRowGap(y: number, rowYs: readonly number[]): number {
  const rows = [...new Set(rowYs)].sort((a, b) => a - b);
  for (let i = 0; i + 1 < rows.length; i++) {
    if (y >= rows[i] && y < rows[i + 1]) return (rows[i] + rows[i + 1]) / 2;
  }
  return y;
}

export type BandArt = { x: number; y: number; size: number; look?: GalaxyLook };

const ART_FRAME_Y = 1100;
const SINGLE_ART_MAX_SPAN = 1500;
const SINGLE_ART_SIZE = 1050;
const REPEAT_ART_SIZES = [1050, 920, 1100, 980] as const;

/**
 * Where a chapter's galaxy artwork sits inside its band. A band that fits one
 * artwork frame keeps the single centred galaxy; a long band (chapter 2 has 28
 * levels) repeats it every ~1100px, swinging left and right and varying the
 * size so the backdrop reaches the last level.
 */
export function bandArtPlacements(band: Pick<ChapterBand, 'top' | 'bottom' | 'art'>): BandArt[] {
  if (band.art) return band.art;
  const span = band.bottom - band.top;
  if (span <= SINGLE_ART_MAX_SPAN) return [{ x: 360, y: (band.top + band.bottom) / 2, size: SINGLE_ART_SIZE }];
  const count = Math.ceil(span / ART_FRAME_Y);
  const spacing = span / count;
  return Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? 250 : 470,
    y: band.top + spacing * (i + 0.5),
    size: REPEAT_ART_SIZES[i % REPEAT_ART_SIZES.length],
  }));
}
