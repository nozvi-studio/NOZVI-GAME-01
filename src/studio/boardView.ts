import { GRID_HEIGHT, GRID_WIDTH } from '../domain/model.ts';
import type { Turns } from '../domain/model.ts';
import { effectiveOrientation, shapePolygon } from '../domain/shapes.ts';
import { filterDecoys } from '../content/authoring.ts';
import type { LevelSource } from '../content/authoring.ts';
import type { StudioAction, StudioState } from './state.ts';
import { layerCounts, outlinePath, snapAndClamp } from './geometry.ts';
import { linkEdges, linkRoles, toggleDrive } from './links.ts';
import type { LinkRole } from './links.ts';

const SCALE = 4;
const WIDTH_PX = GRID_WIDTH * SCALE; // 512
const HEIGHT_PX = GRID_HEIGHT * SCALE; // 640

export type BoardViewOptions = {
  getState: () => StudioState;
  dispatch: (action: StudioAction) => void;
};

export type BoardView = {
  element: HTMLElement;
  render: () => void;
};

function maskToSvgPath(
  mask: Uint8Array,
  scale: number,
  predicate: (count: number) => boolean
): string {
  const parts: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let x = 0;
    while (x < GRID_WIDTH) {
      if (!predicate(mask[y * GRID_WIDTH + x])) {
        x++;
        continue;
      }
      const start = x;
      while (x < GRID_WIDTH && predicate(mask[y * GRID_WIDTH + x])) x++;
      parts.push(`M${start * scale} ${y * scale}h${(x - start) * scale}v${scale}h${-(x - start) * scale}z`);
    }
  }
  return parts.join('');
}

export function createBoardView(options: BoardViewOptions): BoardView {
  const container = document.createElement('div');
  container.className = 'studio-board-container';
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.backgroundColor = '#070a14';
  container.style.padding = '16px';
  container.style.userSelect = 'none';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(WIDTH_PX));
  svg.setAttribute('height', String(HEIGHT_PX));
  svg.setAttribute('viewBox', `0 0 ${WIDTH_PX} ${HEIGHT_PX}`);
  svg.style.borderRadius = '8px';
  svg.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
  svg.style.backgroundColor = '#0b1022';
  svg.style.cursor = 'crosshair';

  container.appendChild(svg);

  // Dragging state
  let isDragging = false;
  let dragKind: 'piece' | 'decoy' | null = null;
  let dragPieceId: string | null = null;
  let dragAnchorId: string | null = null;
  let dragStartPointerX = 0;
  let dragStartPointerY = 0;
  let initialAnchorX = 0;
  let initialAnchorY = 0;

  function getSvgPoint(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(WIDTH_PX, clientX - rect.left));
    const y = Math.max(0, Math.min(HEIGHT_PX, clientY - rect.top));
    return { x, y };
  }

  function handlePointerDown(e: MouseEvent) {
    const target = e.target as SVGElement;
    const anchorEl = target.closest('[data-anchor-id]') as SVGElement | null;
    const pieceEl = target.closest('[data-piece-id]') as SVGElement | null;

    if (anchorEl) {
      e.stopPropagation();
      const pId = anchorEl.getAttribute('data-piece-parent-id')!;
      const aId = anchorEl.getAttribute('data-anchor-id')!;
      options.dispatch({ type: 'select-anchor', pieceId: pId, anchorId: aId });

      isDragging = true;
      dragPieceId = pId;
      dragAnchorId = aId;
      dragKind = aId === 'A' ? 'piece' : 'decoy';

      const pt = getSvgPoint(e);
      dragStartPointerX = pt.x;
      dragStartPointerY = pt.y;

      const state = options.getState();
      const piece = state.source.pieces.find((p) => p.id === pId);
      const anchor = piece?.anchors.find((a) => a.id === aId);
      initialAnchorX = anchor ? anchor.x : 0;
      initialAnchorY = anchor ? anchor.y : 0;
      return;
    }

    if (pieceEl) {
      e.stopPropagation();
      const pId = pieceEl.getAttribute('data-piece-id')!;
      const current = options.getState();
      const selectedId = current.selectedPieceId;
      if (e.shiftKey && selectedId && selectedId !== pId && current.source.rotationEnabled) {
        // Shift+click another piece: link (or unlink) selected -> clicked, without moving anything.
        const selectedPiece = current.source.pieces.find((p) => p.id === selectedId);
        options.dispatch({
          type: 'set-drives',
          pieceId: selectedId,
          targets: toggleDrive(selectedPiece?.drives ?? [], pId),
        });
        return;
      }
      options.dispatch({ type: 'select-piece', id: pId });

      isDragging = true;
      dragPieceId = pId;
      dragAnchorId = 'A';
      dragKind = 'piece';

      const pt = getSvgPoint(e);
      dragStartPointerX = pt.x;
      dragStartPointerY = pt.y;

      const state = options.getState();
      const piece = state.source.pieces.find((p) => p.id === pId);
      const anchorA = piece?.anchors.find((a) => a.id === 'A');
      initialAnchorX = anchorA ? anchorA.x : 0;
      initialAnchorY = anchorA ? anchorA.y : 0;
      return;
    }

    // Clicked empty board
    options.dispatch({ type: 'select-piece', id: null });
  }

  function handlePointerMove(e: MouseEvent) {
    if (!isDragging || !dragPieceId) return;

    const pt = getSvgPoint(e);
    const deltaCellsX = (pt.x - dragStartPointerX) / SCALE;
    const deltaCellsY = (pt.y - dragStartPointerY) / SCALE;

    const rawX = initialAnchorX + deltaCellsX;
    const rawY = initialAnchorY + deltaCellsY;

    const state = options.getState();
    const piece = state.source.pieces.find((p) => p.id === dragPieceId);
    if (!piece) return;

    if (dragKind === 'piece') {
      const step = state.source.sampleSolutions?.[0]?.find((s) => s.pieceId === piece.id);
      const turns = (step?.turns ?? 0) as Turns;
      const clamped = snapAndClamp(piece, turns, rawX, rawY);
      options.dispatch({
        type: 'move-piece',
        id: dragPieceId,
        x: clamped.x,
        y: clamped.y,
      });
    } else if (dragKind === 'decoy' && dragAnchorId) {
      const snappedX = Math.round(rawX / 8) * 8;
      const snappedY = Math.round(rawY / 8) * 8;
      options.dispatch({
        type: 'move-decoy',
        pieceId: dragPieceId,
        anchorId: dragAnchorId,
        x: snappedX,
        y: snappedY,
      });
    }
  }

  function handlePointerUp() {
    isDragging = false;
    dragKind = null;
    dragPieceId = null;
    dragAnchorId = null;
  }

  svg.addEventListener('mousedown', handlePointerDown);
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerUp);

  const LINK_COLORS: Record<LinkRole, string> = { driver: '#f59e0b', driven: '#22d3ee', both: '#c084fc' };

  /** Arrows driver -> driven plus a role badge per linked piece; links of the selected piece stand out. */
  function drawLinks(source: LevelSource, selectedId: string | null) {
    const edges = linkEdges(source.pieces);
    if (edges.length === 0) return;
    const ns = 'http://www.w3.org/2000/svg';

    const defs = document.createElementNS(ns, 'defs');
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'studio-link-arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const head = document.createElementNS(ns, 'path');
    head.setAttribute('d', 'M0 0L10 5L0 10z');
    head.setAttribute('fill', LINK_COLORS.driver);
    marker.appendChild(head);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const centre = (id: string): { x: number; y: number } | null => {
      const piece = source.pieces.find((p) => p.id === id);
      const anchor = piece?.anchors.find((a) => a.id === 'A');
      if (!piece || !anchor) return null;
      return { x: (anchor.x + piece.frameSize / 2) * SCALE, y: (anchor.y + piece.frameSize / 2) * SCALE };
    };

    for (const edge of edges) {
      const from = centre(edge.from);
      const to = centre(edge.to);
      if (!from || !to) continue;
      // Shift each arrow sideways a little so a two-way link shows as two separate arrows.
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * 3;
      const oy = (dx / len) * 3;
      const related = selectedId === null || edge.from === selectedId || edge.to === selectedId;

      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(from.x + ox));
      line.setAttribute('y1', String(from.y + oy));
      line.setAttribute('x2', String(to.x + ox));
      line.setAttribute('y2', String(to.y + oy));
      line.setAttribute('stroke', LINK_COLORS.driver);
      line.setAttribute('stroke-width', related && selectedId !== null ? '3' : '2');
      line.setAttribute('stroke-opacity', related ? '0.95' : '0.3');
      line.setAttribute('marker-end', 'url(#studio-link-arrow)');
      line.setAttribute('pointer-events', 'none');
      svg.appendChild(line);
    }

    const roles = linkRoles(source.pieces);
    for (const piece of source.pieces) {
      const role = roles[piece.id];
      const anchor = piece.anchors.find((a) => a.id === 'A');
      if (!role || !anchor) continue;
      const cx = (anchor.x + piece.frameSize) * SCALE - 10;
      const cy = anchor.y * SCALE + 10;

      const badge = document.createElementNS(ns, 'circle');
      badge.setAttribute('cx', String(cx));
      badge.setAttribute('cy', String(cy));
      badge.setAttribute('r', '8');
      badge.setAttribute('fill', LINK_COLORS[role]);
      badge.setAttribute('stroke', '#0b1022');
      badge.setAttribute('stroke-width', '2');
      badge.setAttribute('pointer-events', 'none');
      svg.appendChild(badge);

      const glyph = document.createElementNS(ns, 'text');
      glyph.setAttribute('x', String(cx));
      glyph.setAttribute('y', String(cy + 4));
      glyph.setAttribute('text-anchor', 'middle');
      glyph.setAttribute('font-size', '11');
      glyph.setAttribute('font-weight', 'bold');
      glyph.setAttribute('fill', '#0b1022');
      glyph.setAttribute('pointer-events', 'none');
      glyph.textContent = '↻';
      svg.appendChild(glyph);
    }
  }

  function render() {
    const state = options.getState();
    const source = state.source;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // 1. Grid background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(WIDTH_PX));
    bg.setAttribute('height', String(HEIGHT_PX));
    bg.setAttribute('fill', '#0b1022');
    svg.appendChild(bg);

    // 2. Grid lines
    for (let x = 0; x <= GRID_WIDTH; x += 8) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x * SCALE));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', String(x * SCALE));
      line.setAttribute('y2', String(HEIGHT_PX));
      line.setAttribute('stroke', x % 24 === 0 ? '#263462' : '#141d3b');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }
    for (let y = 0; y <= GRID_HEIGHT; y += 8) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', String(y * SCALE));
      line.setAttribute('x2', String(WIDTH_PX));
      line.setAttribute('y2', String(y * SCALE));
      line.setAttribute('stroke', y % 24 === 0 ? '#263462' : '#141d3b');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }

    // 3. Parity fill (XOR layers)
    const layers = layerCounts(source);
    const oddPath = maskToSvgPath(layers, SCALE, (c) => c % 2 === 1);
    if (oddPath) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', oddPath);
      p.setAttribute('fill', '#f59e0b');
      p.setAttribute('fill-opacity', '0.45');
      svg.appendChild(p);
    }

    // 4. Boundary outline for 3+ layers
    const outline = outlinePath(layers, SCALE);
    if (outline) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', outline);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#fef08a');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-dasharray', '4 4');
      svg.appendChild(p);
    }

    // 5. Pieces & Decoys
    const { dropped } = filterDecoys(source);
    const droppedDecoyKeys = new Set(dropped.map((d) => `${d.pieceId}:${d.anchorId}`));

    source.pieces.forEach((piece) => {
      const isSelected = state.selectedPieceId === piece.id;
      const step = source.sampleSolutions?.[0]?.find((s) => s.pieceId === piece.id);
      const turns = (step?.turns ?? 0) as Turns;
      const orientation = effectiveOrientation(piece.shapeKind, piece.orientation ?? 0, turns);

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (!anchorA) return;

      const pieceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      pieceGroup.setAttribute('data-piece-id', piece.id);

      // Frame rectangle (dashed)
      const frameRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      frameRect.setAttribute('x', String(anchorA.x * SCALE));
      frameRect.setAttribute('y', String(anchorA.y * SCALE));
      frameRect.setAttribute('width', String(piece.frameSize * SCALE));
      frameRect.setAttribute('height', String(piece.frameSize * SCALE));
      frameRect.setAttribute('fill', isSelected ? 'rgba(56, 189, 248, 0.04)' : 'none');
      frameRect.setAttribute('stroke', isSelected ? '#38bdf8' : '#1e293b');
      frameRect.setAttribute('stroke-width', '1');
      frameRect.setAttribute('stroke-dasharray', '3 3');
      // Decorative only: a filled frame of the selected piece must not swallow clicks meant for pieces it overlaps.
      frameRect.setAttribute('pointer-events', 'none');
      pieceGroup.appendChild(frameRect);

      // Piece polygon
      const verts = shapePolygon(piece.shapeKind, orientation, piece.frameSize);
      const points = verts
        .map((v) => `${(anchorA.x + v.x) * SCALE},${(anchorA.y + v.y) * SCALE}`)
        .join(' ');

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('fill', isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)');
      poly.setAttribute('stroke', isSelected ? '#38bdf8' : '#64748b');
      poly.setAttribute('stroke-width', isSelected ? '3' : '1.5');
      poly.style.cursor = 'grab';
      pieceGroup.appendChild(poly);

      // Anchors
      piece.anchors.forEach((a) => {
        const isAnchorSelected = isSelected && state.selectedAnchorId === a.id;
        const cx = a.x * SCALE;
        const cy = a.y * SCALE;

        const isA = a.id === 'A';
        const isDropped = !isA && droppedDecoyKeys.has(`${piece.id}:${a.id}`);
        const isOutOfBounds =
          a.x < 0 || a.y < 0 || a.x + piece.frameSize > GRID_WIDTH || a.y + piece.frameSize > GRID_HEIGHT;
        const isInvalid = !isA && (isDropped || isOutOfBounds);

        const anchorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        anchorGroup.setAttribute('data-anchor-id', a.id);
        anchorGroup.setAttribute('data-piece-parent-id', piece.id);
        anchorGroup.style.cursor = 'move';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', isAnchorSelected ? '8' : '6');

        if (isA) {
          circle.setAttribute('fill', '#f59e0b');
          circle.setAttribute('stroke', '#000000');
          circle.setAttribute('stroke-width', '2');
        } else if (isInvalid) {
          circle.setAttribute('fill', '#ef4444');
          circle.setAttribute('stroke', '#7f1d1d');
          circle.setAttribute('stroke-width', '2');
        } else {
          circle.setAttribute('fill', '#0284c7');
          circle.setAttribute('stroke', '#0c4a6e');
          circle.setAttribute('stroke-width', '2');
          circle.setAttribute('stroke-dasharray', '2 2');
        }
        anchorGroup.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(cx));
        text.setAttribute('y', String(cy + 3.5));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-size', '9');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('pointer-events', 'none');
        text.textContent = a.id;
        anchorGroup.appendChild(text);

        pieceGroup.appendChild(anchorGroup);
      });

      svg.appendChild(pieceGroup);
    });
    drawLinks(source, state.selectedPieceId);
  }

  render();

  return {
    element: container,
    render,
  };
}
