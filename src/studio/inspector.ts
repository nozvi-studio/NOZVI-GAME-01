import type { Chapter, PlacementMode, Turns } from '../domain/model.ts';
import { isValidFrame } from '../domain/shapes.ts';
import type { AuthorResult } from '../content/authorLevel.ts';
import { CHAPTERS, chapterForbidsOverlap, chapterLabel } from '../content/chapters.ts';
import type { StudioAction, StudioState } from './state.ts';
import { cloneLevelSource, isDirty } from './state.ts';
import { isCampaignId } from '../content/manifest.ts';
import { saveStudioLevelApi } from './api.ts';
import { orientationFamilies, previewPoints } from './orientationOptions.ts';
import { describeIssue } from './issueLabels.ts';
import { formatSeconds, parInfo } from './parInfo.ts';
import { pressSummary, toggleDrive } from './links.ts';

export type InspectorOptions = {
  getState: () => StudioState;
  dispatch: (action: StudioAction) => void;
  onSaved: () => void;
};

export type Inspector = {
  element: HTMLElement;
  setCheckResult: (result: AuthorResult | null, isStale: boolean) => void;
  render: () => void;
};

const COMPONENT_LABELS: Record<string, string> = {
  pieces: 'Số mảnh',
  choices: 'Tư thế khả dĩ',
  hollow: 'Vùng rỗng chẵn',
  revive: 'Hạt nhân lẻ',
  nearMiss: 'Suýt đúng',
  hiddenEdges: 'Biên ẩn',
};

export function createInspector(options: InspectorOptions): Inspector {
  const container = document.createElement('div');
  container.className = 'studio-inspector';
  container.style.width = '340px';
  container.style.minWidth = '340px';
  container.style.backgroundColor = '#0d1326';
  container.style.borderLeft = '1px solid #1e294b';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.overflowY = 'auto';
  container.style.color = '#e2e8f0';
  container.style.padding = '16px';
  container.style.boxSizing = 'border-box';
  container.style.fontSize = '13px';

  let latestCheck: AuthorResult | null = null;
  let isSaving = false;

  function render() {
    // Preserve focus & cursor position if user is typing in an input
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    let focusedFieldId: string | null = null;
    let selStart: number | null = null;
    let selEnd: number | null = null;
    if (activeEl && container.contains(activeEl) && activeEl.dataset.field) {
      focusedFieldId = activeEl.dataset.field;
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }

    container.innerHTML = '';
    const state = options.getState();
    const source = state.source;
    const dirty = isDirty(state);

    // Header
    const header = document.createElement('h2');
    header.textContent = 'THÔNG SỐ MÀN';
    header.style.margin = '0 0 16px 0';
    header.style.fontSize = '16px';
    header.style.letterSpacing = '1px';
    header.style.color = '#38bdf8';
    container.appendChild(header);

    // Form fields
    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';
    form.style.marginBottom = '20px';

    function addRow(label: string, element: HTMLElement) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.gap = '4px';

      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.style.fontSize = '11px';
      lbl.style.fontWeight = 'bold';
      lbl.style.color = '#94a3b8';
      row.appendChild(lbl);
      row.appendChild(element);
      form.appendChild(row);
    }

    // ID (Readonly)
    const isCampaign = isCampaignId(source.id);
    const idContainer = document.createElement('div');
    idContainer.style.display = 'flex';
    idContainer.style.flexDirection = 'column';
    idContainer.style.gap = '4px';

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.value = source.id;
    idInput.readOnly = true;
    idInput.style.padding = '6px 8px';
    idInput.style.backgroundColor = '#141c33';
    idInput.style.color = '#64748b';
    idInput.style.border = '1px solid #1e294b';
    idInput.style.borderRadius = '4px';
    idContainer.appendChild(idInput);

    if (isCampaign) {
      const campTag = document.createElement('div');
      campTag.textContent = '⚠️ Màn Chiến dịch (chỉ đọc) — bấm Lưu sẽ yêu cầu đổi mã Studio';
      campTag.style.fontSize = '11px';
      campTag.style.color = '#f59e0b';
      idContainer.appendChild(campTag);
    }
    addRow('Mã màn (ID - chỉ đọc)', idContainer);

    // Chapter & Placement row
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.gap = '8px';

    const chapCol = document.createElement('div');
    chapCol.style.flex = '1';
    const chapSelect = document.createElement('select');
    chapSelect.style.width = '100%';
    chapSelect.style.padding = '6px 8px';
    chapSelect.style.backgroundColor = '#1e294b';
    chapSelect.style.color = '#e2e8f0';
    chapSelect.style.border = '1px solid #334155';
    chapSelect.style.borderRadius = '4px';
    CHAPTERS.forEach((info) => {
      const opt = document.createElement('option');
      opt.value = String(info.chapter);
      opt.textContent = chapterLabel(info.chapter);
      if (info.chapter === source.chapter) opt.selected = true;
      chapSelect.appendChild(opt);
    });
    chapSelect.onchange = () => {
      options.dispatch({ type: 'set-field', field: 'chapter', value: Number(chapSelect.value) as Chapter });
    };
    chapCol.appendChild(chapSelect);

    const placeCol = document.createElement('div');
    placeCol.style.flex = '1';
    const placeSelect = document.createElement('select');
    placeSelect.style.width = '100%';
    placeSelect.style.padding = '6px 8px';
    placeSelect.style.backgroundColor = '#1e294b';
    placeSelect.style.color = '#e2e8f0';
    placeSelect.style.border = '1px solid #334155';
    placeSelect.style.borderRadius = '4px';
    [
      { value: 'anchors', label: 'Neo' },
      { value: 'free', label: 'Tự do (free)' },
    ].forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      if ((source.placement ?? 'anchors') === m.value) opt.selected = true;
      placeSelect.appendChild(opt);
    });
    placeSelect.onchange = () => {
      options.dispatch({ type: 'set-placement', placement: placeSelect.value as PlacementMode });
    };
    placeCol.appendChild(placeSelect);

    row2.appendChild(chapCol);
    row2.appendChild(placeCol);
    addRow('Chương & Chế độ đặt', row2);

    if (chapterForbidsOverlap(source.chapter)) {
      const overlapHint = document.createElement('div');
      overlapHint.textContent = 'Chương này cấm xếp chồng: nghiệm mẫu không được có mảnh chồng lên nhau.';
      overlapHint.style.fontSize = '11px';
      overlapHint.style.color = '#fbbf24';
      form.appendChild(overlapHint);
    }

    // Rotation enabled checkbox
    const rotRow = document.createElement('div');
    rotRow.style.display = 'flex';
    rotRow.style.alignItems = 'center';
    rotRow.style.gap = '8px';
    const rotCheck = document.createElement('input');
    rotCheck.type = 'checkbox';
    rotCheck.checked = Boolean(source.rotationEnabled);
    rotCheck.id = 'studio-rot-check';
    rotCheck.onchange = () => {
      options.dispatch({ type: 'set-rotation', enabled: rotCheck.checked });
    };
    const rotLbl = document.createElement('label');
    rotLbl.htmlFor = 'studio-rot-check';
    rotLbl.textContent = 'Bật xoay mảnh';
    rotLbl.style.cursor = 'pointer';
    rotRow.appendChild(rotCheck);
    rotRow.appendChild(rotLbl);
    form.appendChild(rotRow);

    // If rotation enabled: show turns per piece
    if (source.rotationEnabled && source.pieces.length > 0) {
      const turnsBox = document.createElement('div');
      turnsBox.style.padding = '8px';
      turnsBox.style.backgroundColor = '#13192f';
      turnsBox.style.borderRadius = '4px';
      turnsBox.style.display = 'flex';
      turnsBox.style.flexDirection = 'column';
      turnsBox.style.gap = '4px';

      const turnsLbl = document.createElement('div');
      turnsLbl.textContent = 'Góc xoay nghiệm mẫu:';
      turnsLbl.style.fontSize = '11px';
      turnsLbl.style.color = '#94a3b8';
      turnsBox.appendChild(turnsLbl);

      source.pieces.forEach((p) => {
        const step = source.sampleSolutions?.[0]?.find((s) => s.pieceId === p.id);
        const curTurns = step?.turns ?? 0;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';

        const name = document.createElement('span');
        name.textContent = `${p.id} (${p.shapeKind})`;
        row.appendChild(name);

        const sel = document.createElement('select');
        sel.style.padding = '2px 6px';
        sel.style.backgroundColor = '#1e294b';
        sel.style.color = '#e2e8f0';
        sel.style.border = '1px solid #334155';
        [0, 1, 2, 3].forEach((t) => {
          const opt = document.createElement('option');
          opt.value = String(t);
          opt.textContent = `${t * 90}°`;
          if (t === curTurns) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => {
          options.dispatch({
            type: 'set-solution-turns',
            pieceId: p.id,
            turns: Number(sel.value) as Turns,
          });
        };
        row.appendChild(sel);
        turnsBox.appendChild(row);
      });
      form.appendChild(turnsBox);

      const linkCard = document.createElement('div');
      linkCard.style.padding = '8px';
      linkCard.style.backgroundColor = '#13192f';
      linkCard.style.borderRadius = '4px';
      linkCard.style.display = 'flex';
      linkCard.style.flexDirection = 'column';
      linkCard.style.gap = '6px';

      const linkTitle = document.createElement('div');
      linkTitle.textContent = 'Liên kết xoay (bấm Xoay trên mảnh dẫn thì mảnh bị dẫn xoay theo):';
      linkTitle.style.fontSize = '11px';
      linkTitle.style.color = '#94a3b8';
      linkCard.appendChild(linkTitle);

      source.pieces.forEach((p) => {
        const followers = p.drives ?? [];
        const linkRow = document.createElement('div');
        linkRow.style.display = 'flex';
        linkRow.style.flexWrap = 'wrap';
        linkRow.style.alignItems = 'center';
        linkRow.style.gap = '4px';

        const who = document.createElement('span');
        who.textContent = `${p.id} dẫn:`;
        who.style.minWidth = '56px';
        linkRow.appendChild(who);

        followers.forEach((followerId) => {
          const chip = document.createElement('button');
          chip.textContent = `${followerId} ×`;
          chip.title = `Gỡ liên kết ${p.id} → ${followerId}`;
          chip.style.padding = '1px 6px';
          chip.style.backgroundColor = '#164e63';
          chip.style.color = '#e2e8f0';
          chip.style.border = '1px solid #22d3ee';
          chip.style.borderRadius = '10px';
          chip.style.cursor = 'pointer';
          chip.onclick = () =>
            options.dispatch({ type: 'set-drives', pieceId: p.id, targets: toggleDrive(followers, followerId) });
          linkRow.appendChild(chip);
        });

        const addable = source.pieces.filter((q) => q.id !== p.id && !followers.includes(q.id));
        if (addable.length > 0) {
          const add = document.createElement('select');
          add.style.padding = '1px 4px';
          add.style.backgroundColor = '#1e294b';
          add.style.color = '#e2e8f0';
          add.style.border = '1px solid #334155';
          const hint = document.createElement('option');
          hint.value = '';
          hint.textContent = '+ nối…';
          add.appendChild(hint);
          addable.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.id;
            add.appendChild(opt);
          });
          add.onchange = () => {
            if (add.value) {
              options.dispatch({ type: 'set-drives', pieceId: p.id, targets: toggleDrive(followers, add.value) });
            }
          };
          linkRow.appendChild(add);
        }
        linkCard.appendChild(linkRow);
      });

      const summary = pressSummary(source);
      const summaryLine = document.createElement('div');
      summaryLine.style.fontSize = '11px';
      if (summary.kind === 'plan') {
        summaryLine.textContent =
          summary.presses.length === 0
            ? 'Không cần bấm Xoay lần nào.'
            : `Kế hoạch bấm: ${summary.presses.map((press) => `${press.id}×${press.count}`).join(', ')} (tổng ${summary.total} lần)`;
        summaryLine.style.color = '#4ade80';
      } else if (summary.kind === 'unreachable') {
        summaryLine.textContent = `Không đạt được tư thế đích bằng các liên kết này. Thử đổi tư thế đích hoặc liên kết của: ${
          summary.culprits.length > 0 ? summary.culprits.join(', ') : 'nhiều mảnh cùng lúc'
        }`;
        summaryLine.style.color = '#f87171';
      } else if (summary.kind === 'too-many') {
        summaryLine.textContent = 'Quá nhiều mảnh để tính kế hoạch bấm.';
        summaryLine.style.color = '#fbbf24';
      } else {
        summaryLine.textContent = 'Chưa có liên kết nào. Giữ Shift và bấm một mảnh trên board để nối từ mảnh đang chọn.';
        summaryLine.style.color = '#94a3b8';
      }
      linkCard.appendChild(summaryLine);

      form.appendChild(linkCard);
    }

    // Difficulty Estimate
    const diffSelect = document.createElement('select');
    diffSelect.style.padding = '6px 8px';
    diffSelect.style.backgroundColor = '#1e294b';
    diffSelect.style.color = '#e2e8f0';
    diffSelect.style.border = '1px solid #334155';
    diffSelect.style.borderRadius = '4px';
    [1, 2, 3, 4, 5].forEach((d) => {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = `Mức ${d} ${'★'.repeat(d)}`;
      if (d === source.difficultyEstimate) opt.selected = true;
      diffSelect.appendChild(opt);
    });
    diffSelect.onchange = () => {
      options.dispatch({ type: 'set-field', field: 'difficultyEstimate', value: Number(diffSelect.value) });
    };
    addRow('Độ khó ước lượng (tác giả)', diffSelect);

    // Hướng của mảnh đang chọn. Nút bị mờ nghĩa là khung hiện tại không hợp
    // cho hướng đó (họ Mái cần khung bội 16); đổi cỡ khung trước rồi chọn lại.
    const selectedPiece = state.selectedPieceId
      ? source.pieces.find((p) => p.id === state.selectedPieceId)
      : null;
    if (selectedPiece) {
      const pieceBox = document.createElement('div');
      pieceBox.style.padding = '10px 12px';
      pieceBox.style.backgroundColor = '#13192f';
      pieceBox.style.borderRadius = '6px';
      pieceBox.style.border = '1px solid #1e294b';
      pieceBox.style.display = 'flex';
      pieceBox.style.flexDirection = 'column';
      pieceBox.style.gap = '8px';

      const pieceTitle = document.createElement('div');
      pieceTitle.textContent = `MẢNH: ${selectedPiece.id} (${selectedPiece.shapeKind}, CỠ ${selectedPiece.frameSize})`;
      pieceTitle.style.fontWeight = 'bold';
      pieceTitle.style.fontSize = '12px';
      pieceTitle.style.color = '#38bdf8';
      pieceBox.appendChild(pieceTitle);

      const families = orientationFamilies(selectedPiece.shapeKind);
      if (families.length > 0) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.flexWrap = 'wrap';
        row.style.gap = '8px';

        families.forEach((family) => {
          const famWrap = document.createElement('div');
          famWrap.style.display = 'flex';
          famWrap.style.alignItems = 'center';
          famWrap.style.gap = '3px';

          const label = document.createElement('span');
          label.textContent = family.label;
          label.style.fontSize = '11px';
          label.style.color = '#94a3b8';
          famWrap.appendChild(label);

          family.orientations.forEach((o) => {
            const allowed = isValidFrame(selectedPiece.shapeKind, o, selectedPiece.frameSize);
            const btn = document.createElement('button');
            btn.title = allowed ? `${family.label} ${o}` : `Khung ${selectedPiece.frameSize} không hợp cho hướng ${o}`;
            btn.disabled = !allowed;
            btn.style.width = '28px';
            btn.style.height = '28px';
            btn.style.padding = '2px';
            btn.style.borderRadius = '4px';
            btn.style.lineHeight = '0';
            btn.style.cursor = allowed ? 'pointer' : 'not-allowed';
            btn.style.opacity = allowed ? '1' : '0.35';
            btn.style.border = o === (selectedPiece.orientation ?? 0) ? '1px solid #38bdf8' : '1px solid #334155';
            btn.style.backgroundColor = o === (selectedPiece.orientation ?? 0) ? '#0b2a3f' : '#1e294b';

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '20');
            svg.setAttribute('height', '20');
            svg.setAttribute('viewBox', '0 0 20 20');
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', previewPoints(selectedPiece.shapeKind, o, 20));
            poly.setAttribute('fill', o === (selectedPiece.orientation ?? 0) ? '#38bdf8' : '#94a3b8');
            svg.appendChild(poly);
            btn.appendChild(svg);

            if (allowed) {
              btn.onclick = () => options.dispatch({ type: 'set-orientation', id: selectedPiece.id, orientation: o });
            }
            famWrap.appendChild(btn);
          });
          row.appendChild(famWrap);
        });

        pieceBox.appendChild(row);
      }

      form.appendChild(pieceBox);
    }

    container.appendChild(form);

    // Section 2: Live validation & solver output
    const checkCard = document.createElement('div');
    checkCard.style.padding = '12px';
    checkCard.style.backgroundColor = '#13192f';
    checkCard.style.borderRadius = '6px';
    checkCard.style.border = '1px solid #1e294b';
    checkCard.style.marginBottom = '20px';

    const checkHeader = document.createElement('div');
    checkHeader.style.display = 'flex';
    checkHeader.style.alignItems = 'center';
    checkHeader.style.justifyContent = 'space-between';
    checkHeader.style.marginBottom = '8px';

    const checkTitle = document.createElement('span');
    checkTitle.textContent = 'KIỂM TRA TRỰC TIẾP';
    checkTitle.style.fontWeight = 'bold';
    checkTitle.style.fontSize = '12px';
    checkTitle.style.color = '#94a3b8';
    checkHeader.appendChild(checkTitle);

    const statusBadge = document.createElement('span');
    statusBadge.style.fontSize = '11px';
    statusBadge.style.padding = '2px 6px';
    statusBadge.style.borderRadius = '3px';
    if (!latestCheck) {
      statusBadge.textContent = 'Đang giải...';
      statusBadge.style.backgroundColor = '#334155';
      statusBadge.style.color = '#94a3b8';
    } else if (latestCheck.ok) {
      statusBadge.textContent = '✓ Hợp lệ';
      statusBadge.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
      statusBadge.style.color = '#4ade80';
    } else {
      statusBadge.textContent = '✗ Lỗi';
      statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      statusBadge.style.color = '#ef4444';
    }
    checkHeader.appendChild(statusBadge);
    checkCard.appendChild(checkHeader);

    if (latestCheck && !latestCheck.ok) {
      const errList = document.createElement('div');
      errList.style.color = '#f87171';
      errList.style.fontSize = '12px';
      errList.style.marginTop = '6px';
      latestCheck.issues?.forEach((iss) => {
        const item = document.createElement('div');
        item.textContent = `• ${iss.field}: ${describeIssue(iss.code)}`;
        errList.appendChild(item);
      });
      checkCard.appendChild(errList);
    } else if (latestCheck && latestCheck.ok) {
      const rep = latestCheck.report;
      const metrics = document.createElement('div');
      metrics.style.display = 'flex';
      metrics.style.flexDirection = 'column';
      metrics.style.gap = '4px';
      metrics.style.fontSize = '12px';

      const solRow = document.createElement('div');
      solRow.innerHTML = `Số nghiệm: <strong style="color: ${rep.solutionCount === 1 ? '#4ade80' : '#f87171'}">${rep.solutionCount}</strong> (Nghiệm ít mảnh: ${rep.fewerPieceSolutions})`;
      metrics.appendChild(solRow);

      const provenRow = document.createElement('div');
      provenRow.textContent = `Đã chứng minh: ${rep.proven ? 'Có' : 'Không'} (${Math.round(rep.elapsedMs)} ms)`;
      metrics.appendChild(provenRow);

      if (latestCheck.doc.parMs !== undefined) {
        const par = parInfo(latestCheck.doc.parMs, latestCheck.doc.pieces.length);
        const [s3, s2, s1] = par.starWindowsMs;
        const parRow = document.createElement('div');
        parRow.textContent = `Par: ${formatSeconds(par.parMs)} · 3★ < ${formatSeconds(s3)} · 2★ < ${formatSeconds(s2)} · 1★ < ${formatSeconds(s1)}`;
        metrics.appendChild(parRow);
      }

      // Warnings
      if (latestCheck.warnings && latestCheck.warnings.length > 0) {
        const warnBox = document.createElement('div');
        warnBox.style.color = '#fbbf24';
        warnBox.style.marginTop = '4px';
        latestCheck.warnings.forEach((w) => {
          const item = document.createElement('div');
          item.textContent = `⚠ ${w.code}: ${w.message}`;
          warnBox.appendChild(item);
        });
        metrics.appendChild(warnBox);
      }

      // Difficulty score
      if (latestCheck.score) {
        const sc = latestCheck.score;
        const diffBox = document.createElement('div');
        diffBox.style.marginTop = '8px';
        diffBox.style.paddingTop = '8px';
        diffBox.style.borderTop = '1px solid #1e294b';

        const diffTitle = document.createElement('div');
        diffTitle.innerHTML = `Điểm máy tính: <strong style="color: #38bdf8">${sc.score} / 5</strong> (raw: ${sc.raw.toFixed(2)})`;
        diffTitle.style.marginBottom = '6px';
        diffBox.appendChild(diffTitle);

        // 6 components horizontal bars
        const partsContainer = document.createElement('div');
        partsContainer.style.display = 'flex';
        partsContainer.style.flexDirection = 'column';
        partsContainer.style.gap = '3px';

        for (const [partKey, val] of Object.entries(sc.parts)) {
          const barRow = document.createElement('div');
          barRow.style.display = 'flex';
          barRow.style.alignItems = 'center';
          barRow.style.fontSize = '10px';

          const lbl = document.createElement('span');
          lbl.style.width = '80px';
          lbl.textContent = COMPONENT_LABELS[partKey] ?? partKey;
          barRow.appendChild(lbl);

          const track = document.createElement('div');
          track.style.flex = '1';
          track.style.height = '6px';
          track.style.backgroundColor = '#1e294b';
          track.style.borderRadius = '3px';
          track.style.overflow = 'hidden';

          const fill = document.createElement('div');
          fill.style.width = `${Math.min(100, Math.max(0, val * 100))}%`;
          fill.style.height = '100%';
          fill.style.backgroundColor = '#38bdf8';
          track.appendChild(fill);
          barRow.appendChild(track);

          const num = document.createElement('span');
          num.style.width = '30px';
          num.style.textAlign = 'right';
          num.textContent = val.toFixed(2);
          barRow.appendChild(num);

          partsContainer.appendChild(barRow);
        }
        diffBox.appendChild(partsContainer);
        metrics.appendChild(diffBox);
      }

      checkCard.appendChild(metrics);
    }

    container.appendChild(checkCard);

    // Section 3: Action buttons
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexDirection = 'column';
    actions.style.gap = '8px';

    // Save button
    const isCamp = isCampaignId(source.id);
    const saveBtn = document.createElement('button');
    if (isSaving) {
      saveBtn.textContent = 'Đang lưu...';
    } else if (isCamp) {
      saveBtn.textContent = 'LƯU BẢN STUDIO (Clone & Lưu)';
    } else {
      saveBtn.textContent = 'LƯU (Save)';
    }
    saveBtn.style.padding = '10px';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.border = 'none';
    saveBtn.style.fontWeight = 'bold';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.cursor = 'pointer';

    const canSave = latestCheck?.ok && !isSaving;
    saveBtn.disabled = !canSave;
    if (canSave) {
      saveBtn.style.backgroundColor = isCamp ? '#d97706' : '#f59e0b';
      saveBtn.style.color = '#000000';
    } else {
      saveBtn.style.backgroundColor = '#1e294b';
      saveBtn.style.color = '#64748b';
    }

    saveBtn.onclick = async () => {
      if (!canSave) return;

      let targetSource = source;
      if (isCampaignId(source.id)) {
        const suggestedId = `mau-${source.id}`;
        const newId = prompt(
          `Màn "${source.id}" thuộc Chiến dịch nên không thể lưu đè.\nVui lòng nhập mã Studio mới để tạo bản lưu:`,
          suggestedId
        );
        if (!newId) return;
        if (!/^[a-z0-9-]{1,32}$/.test(newId)) {
          alert('Mã màn chỉ gồm chữ thường, số và gạch ngang (tối đa 32 ký tự).');
          return;
        }
        if (isCampaignId(newId)) {
          alert(`Mã "${newId}" trùng với màn trong chiến dịch. Vui lòng chọn mã khác (bắt đầu bằng mau- hoặc studio-).`);
          return;
        }
        targetSource = cloneLevelSource(source, newId);
        options.dispatch({ type: 'load-source', source: targetSource });
        window.location.hash = `#${newId}`;
      }

      isSaving = true;
      render();
      try {
        const res = await saveStudioLevelApi(targetSource);
        if (res.ok) {
          options.dispatch({ type: 'mark-saved' });
          options.onSaved();
          alert(`Đã lưu màn "${targetSource.id}" thành công!`);
        } else {
          if (res.error === 'id-clash-campaign') {
            alert(`Lỗi khi lưu: Mã màn "${targetSource.id}" trùng với màn chiến dịch. Vui lòng đổi mã khác.`);
          } else {
            alert(`Lỗi khi lưu: ${res.error}`);
          }
        }
      } catch (err) {
        alert(`Lỗi kết nối: ${(err as Error).message}`);
      } finally {
        isSaving = false;
        render();
      }
    };
    actions.appendChild(saveBtn);

    // Test Play button
    const playBtn = document.createElement('button');
    playBtn.textContent = '▶ Chơi thử (Harness)';
    playBtn.style.padding = '8px';
    playBtn.style.borderRadius = '6px';
    playBtn.style.border = '1px solid #334155';
    playBtn.style.fontWeight = 'bold';
    playBtn.style.fontSize = '13px';
    playBtn.style.cursor = 'pointer';

    const canPlay = !dirty && latestCheck?.ok;
    playBtn.disabled = !canPlay;
    if (canPlay) {
      playBtn.style.backgroundColor = '#0369a1';
      playBtn.style.color = '#ffffff';
    } else {
      playBtn.style.backgroundColor = '#13192f';
      playBtn.style.color = '#64748b';
      playBtn.title = dirty ? 'Lưu trước khi chơi thử' : '';
    }
    playBtn.onclick = () => {
      window.open(`/?scene=play&level=${source.id}&mode=harness`, '_blank');
    };
    actions.appendChild(playBtn);

    // Open SVG button
    const svgBtn = document.createElement('button');
    svgBtn.textContent = '🖼 Mở SVG';
    svgBtn.style.padding = '8px';
    svgBtn.style.borderRadius = '6px';
    svgBtn.style.border = '1px solid #334155';
    svgBtn.style.backgroundColor = '#13192f';
    svgBtn.style.color = '#e2e8f0';
    svgBtn.style.cursor = 'pointer';
    const svgContent = latestCheck?.ok ? latestCheck.svg : undefined;
    svgBtn.disabled = !svgContent;
    svgBtn.onclick = () => {
      if (!svgContent) return;
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    };
    actions.appendChild(svgBtn);

    container.appendChild(actions);

    // Restore focus & cursor position if an input was active before re-render
    if (focusedFieldId) {
      const targetInput = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${focusedFieldId}"]`
      );
      if (targetInput) {
        targetInput.focus();
        if (selStart !== null && selEnd !== null) {
          try {
            targetInput.setSelectionRange(selStart, selEnd);
          } catch {
            // Some input types don't support selection range
          }
        }
      }
    }
  }

  return {
    element: container,
    setCheckResult(result: AuthorResult | null) {
      latestCheck = result;
      render();
    },
    render,
  };
}
