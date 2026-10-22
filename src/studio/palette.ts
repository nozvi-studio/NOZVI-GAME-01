import type { Orientation, ShapeKind } from '../domain/model.ts';
import type { StudioAction, StudioState } from './state.ts';
import {
  orientationFamilies,
  previewPoints,
  snapFrameSize,
  validFrameSizes,
} from './orientationOptions.ts';

export type PaletteOptions = {
  getState: () => StudioState;
  dispatch: (action: StudioAction) => void;
};

export type Palette = {
  element: HTMLElement;
  render: () => void;
};

const ALL_SHAPES: Array<{ kind: ShapeKind; label: string }> = [
  { kind: 'square', label: 'Vuông' },
  { kind: 'triangle', label: 'Tam giác' },
  { kind: 'diamond', label: 'Thoi' },
  { kind: 'circle', label: 'Tròn' },
  { kind: 'parallelogram', label: 'Bình hành' },
];

export function createPalette(options: PaletteOptions): Palette {
  const container = document.createElement('div');
  container.className = 'studio-palette';
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.alignItems = 'center';
  container.style.gap = '10px';
  container.style.padding = '12px 16px';
  container.style.backgroundColor = '#13192f';
  container.style.borderBottom = '1px solid #1e294b';
  container.style.color = '#e2e8f0';
  // Selecting a piece adds its controls and wraps the bar onto a second line; reserve that height
  // so the centred board does not jump under the cursor.
  container.style.boxSizing = 'border-box';
  container.style.minHeight = '97px';

  let selectedKind: ShapeKind = 'square';
  let selectedOrientation: Orientation = 0;
  let selectedSize: number = 48;

  function updateValidSizes(): number[] {
    selectedSize = snapFrameSize(selectedKind, selectedOrientation, selectedSize);
    return validFrameSizes(selectedKind, selectedOrientation);
  }

  function render() {
    container.innerHTML = '';
    const state = options.getState();

    // 1. Shape selector buttons
    const shapeGroup = document.createElement('div');
    shapeGroup.style.display = 'flex';
    shapeGroup.style.gap = '4px';

    ALL_SHAPES.forEach(({ kind, label }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '6px 12px';
      btn.style.borderRadius = '4px';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.fontWeight = 'bold';
      btn.style.fontSize = '13px';
      if (selectedKind === kind) {
        btn.style.backgroundColor = '#38bdf8';
        btn.style.color = '#0b1022';
      } else {
        btn.style.backgroundColor = '#1e294b';
        btn.style.color = '#94a3b8';
      }
      btn.onclick = () => {
        selectedKind = kind;
        selectedOrientation = 0;
        updateValidSizes();
        render();
      };
      shapeGroup.appendChild(btn);
    });
    container.appendChild(shapeGroup);

    // 2. Size selector
    const validSizes = updateValidSizes();
    const sizeSelect = document.createElement('select');
    sizeSelect.style.padding = '6px 10px';
    sizeSelect.style.borderRadius = '4px';
    sizeSelect.style.backgroundColor = '#1e294b';
    sizeSelect.style.color = '#e2e8f0';
    sizeSelect.style.border = '1px solid #334155';
    sizeSelect.style.cursor = 'pointer';
    validSizes.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = `Cỡ ${s}`;
      if (s === selectedSize) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.onchange = () => {
      selectedSize = Number(sizeSelect.value);
    };
    container.appendChild(sizeSelect);

    // 3. Orientation picker: ảnh xem trước thật, chia theo họ
    const families = orientationFamilies(selectedKind);
    if (families.length > 0) {
      const oriGroup = document.createElement('div');
      oriGroup.className = 'studio-orientation';
      oriGroup.style.display = 'flex';
      oriGroup.style.alignItems = 'center';
      oriGroup.style.gap = '8px';

      families.forEach((family) => {
        const famWrap = document.createElement('div');
        famWrap.style.display = 'flex';
        famWrap.style.alignItems = 'center';
        famWrap.style.gap = '3px';

        const famLabel = document.createElement('span');
        famLabel.textContent = family.label;
        famLabel.style.fontSize = '11px';
        famLabel.style.color = '#94a3b8';
        famWrap.appendChild(famLabel);

        family.orientations.forEach((o) => {
          const btn = document.createElement('button');
          btn.title = `${family.label} ${o}`;
          btn.setAttribute('data-orientation', String(o));
          btn.style.width = '32px';
          btn.style.height = '32px';
          btn.style.padding = '3px';
          btn.style.borderRadius = '4px';
          btn.style.cursor = 'pointer';
          btn.style.lineHeight = '0';
          if (o === selectedOrientation) {
            btn.style.border = '1px solid #38bdf8';
            btn.style.backgroundColor = '#0b2a3f';
          } else {
            btn.style.border = '1px solid #334155';
            btn.style.backgroundColor = '#1e294b';
          }

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '24');
          svg.setAttribute('height', '24');
          svg.setAttribute('viewBox', '0 0 24 24');
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          poly.setAttribute('points', previewPoints(selectedKind, o, 24));
          poly.setAttribute('fill', o === selectedOrientation ? '#38bdf8' : '#94a3b8');
          svg.appendChild(poly);
          btn.appendChild(svg);

          btn.onclick = () => {
            selectedOrientation = o;
            updateValidSizes();
            render();
          };
          famWrap.appendChild(btn);
        });

        oriGroup.appendChild(famWrap);
      });

      container.appendChild(oriGroup);
    }

    // 4. Add piece button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Thêm mảnh';
    addBtn.style.padding = '6px 14px';
    addBtn.style.borderRadius = '4px';
    addBtn.style.border = 'none';
    addBtn.style.backgroundColor = '#f59e0b';
    addBtn.style.color = '#000000';
    addBtn.style.fontWeight = 'bold';
    addBtn.style.cursor = 'pointer';
    addBtn.onclick = () => {
      options.dispatch({
        type: 'add-piece',
        shapeKind: selectedKind,
        frameSize: selectedSize,
        orientation: selectedOrientation,
      });
    };
    container.appendChild(addBtn);

    // Separator
    const sep = document.createElement('div');
    sep.style.width = '1px';
    sep.style.height = '24px';
    sep.style.backgroundColor = '#334155';
    container.appendChild(sep);

    // 5. Piece-specific controls
    const selId = state.selectedPieceId;
    if (selId) {
      const rotBtn = document.createElement('button');
      rotBtn.textContent = '↻ Xoay (R)';
      rotBtn.style.padding = '6px 10px';
      rotBtn.style.borderRadius = '4px';
      rotBtn.style.border = '1px solid #334155';
      rotBtn.style.backgroundColor = '#1e294b';
      rotBtn.style.color = '#e2e8f0';
      rotBtn.style.cursor = 'pointer';
      rotBtn.onclick = () => options.dispatch({ type: 'rotate-piece', id: selId });
      container.appendChild(rotBtn);

      const mirrorBtn = document.createElement('button');
      mirrorBtn.textContent = '⇆ Lật (Shift+R)';
      mirrorBtn.style.padding = '6px 10px';
      mirrorBtn.style.borderRadius = '4px';
      mirrorBtn.style.border = '1px solid #334155';
      mirrorBtn.style.backgroundColor = '#1e294b';
      mirrorBtn.style.color = '#e2e8f0';
      mirrorBtn.style.cursor = 'pointer';
      mirrorBtn.onclick = () => options.dispatch({ type: 'mirror-piece', id: selId });
      container.appendChild(mirrorBtn);

      if (state.source.placement !== 'free') {
        const decoyBtn = document.createElement('button');
        decoyBtn.textContent = '+ Neo nhiễu';
        decoyBtn.style.padding = '6px 10px';
        decoyBtn.style.borderRadius = '4px';
        decoyBtn.style.border = '1px solid #0284c7';
        decoyBtn.style.backgroundColor = '#0369a1';
        decoyBtn.style.color = '#ffffff';
        decoyBtn.style.cursor = 'pointer';
        decoyBtn.onclick = () => options.dispatch({ type: 'add-decoy', pieceId: selId });
        container.appendChild(decoyBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑 Xoá (Del)';
      delBtn.style.padding = '6px 10px';
      delBtn.style.borderRadius = '4px';
      delBtn.style.border = '1px solid #ef4444';
      delBtn.style.backgroundColor = '#991b1b';
      delBtn.style.color = '#ffffff';
      delBtn.style.cursor = 'pointer';
      delBtn.onclick = () => options.dispatch({ type: 'delete-piece', id: selId });
      container.appendChild(delBtn);
    }
  }

  render();

  return {
    element: container,
    render,
  };
}
