import { campaignManifest, isCampaignId } from '../content/manifest.ts';
import type { StudioLevelSummary } from '../content/studioStore.ts';
import { levelTemplate } from '../content/sources/_template.ts';
import { sourceFromDocument } from '../content/sourceFromDocument.ts';
import type { StudioAction, StudioState } from './state.ts';
import { cloneLevelSource, isDirty } from './state.ts';
import { deleteStudioLevelApi, fetchStudioLevelDoc, fetchStudioList, promoteStudioLevelApi } from './api.ts';

export type LibraryOptions = {
  getState: () => StudioState;
  dispatch: (action: StudioAction) => void;
  onSelectLevel: (id: string) => void;
};

export type Library = {
  element: HTMLElement;
  refresh: () => Promise<void>;
  render: () => void;
};

export function createLibrary(options: LibraryOptions): Library {
  const container = document.createElement('div');
  container.className = 'studio-library';
  container.style.width = '280px';
  container.style.minWidth = '280px';
  container.style.backgroundColor = '#0d1326';
  container.style.borderRight = '1px solid #1e294b';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.overflowY = 'auto';
  container.style.color = '#e2e8f0';
  container.style.padding = '16px';
  container.style.boxSizing = 'border-box';

  let studioLevels: StudioLevelSummary[] = [];

  async function refresh() {
    try {
      studioLevels = await fetchStudioList();
    } catch {
      studioLevels = [];
    }
    render();
  }

  function render() {
    container.innerHTML = '';
    const state = options.getState();
    const currentId = state.source.id;
    const dirty = isDirty(state);

    // Header & Actions
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '12px';

    const title = document.createElement('h2');
    title.textContent = 'KHO MÀN';
    title.style.margin = '0';
    title.style.fontSize = '16px';
    title.style.letterSpacing = '1px';
    title.style.color = '#38bdf8';
    header.appendChild(title);
    container.appendChild(header);

    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '8px';
    actionRow.style.marginBottom = '16px';

    const newBtn = document.createElement('button');
    newBtn.textContent = '+ Tạo mới';
    newBtn.style.flex = '1';
    newBtn.style.padding = '6px';
    newBtn.style.borderRadius = '4px';
    newBtn.style.border = 'none';
    newBtn.style.backgroundColor = '#1e294b';
    newBtn.style.color = '#f8fafc';
    newBtn.style.fontSize = '12px';
    newBtn.style.fontWeight = 'bold';
    newBtn.style.cursor = 'pointer';
    newBtn.onclick = () => {
      const id = prompt('Nhập mã màn mới (vd: my-level):');
      if (!id) return;
      if (!/^[a-z0-9-]{1,32}$/.test(id)) {
        alert('Mã màn chỉ gồm chữ thường, số và gạch ngang (tối đa 32 ký tự)');
        return;
      }
      if (isCampaignId(id)) {
        alert(`Mã "${id}" trùng với màn chiến dịch. Vui lòng chọn mã khác (bắt đầu bằng mau- hoặc studio-).`);
        return;
      }
      const newSource = cloneLevelSource(levelTemplate, id);
      options.dispatch({ type: 'load-source', source: newSource });
      window.location.hash = `#${id}`;
    };
    actionRow.appendChild(newBtn);

    const cloneBtn = document.createElement('button');
    cloneBtn.textContent = 'Clone';
    cloneBtn.style.flex = '1';
    cloneBtn.style.padding = '6px';
    cloneBtn.style.borderRadius = '4px';
    cloneBtn.style.border = 'none';
    cloneBtn.style.backgroundColor = '#1e294b';
    cloneBtn.style.color = '#f8fafc';
    cloneBtn.style.fontSize = '12px';
    cloneBtn.style.fontWeight = 'bold';
    cloneBtn.style.cursor = 'pointer';
    cloneBtn.onclick = () => {
      const suggested = isCampaignId(currentId) ? `mau-${currentId}` : `${currentId}-copy`;
      const id = prompt(`Nhập mã clone từ "${currentId}":`, suggested);
      if (!id) return;
      if (!/^[a-z0-9-]{1,32}$/.test(id)) {
        alert('Mã màn chỉ gồm chữ thường, số và gạch ngang (tối đa 32 ký tự)');
        return;
      }
      if (isCampaignId(id)) {
        alert(`Mã "${id}" trùng với màn chiến dịch. Vui lòng chọn mã khác (bắt đầu bằng mau- hoặc studio-).`);
        return;
      }
      const cloned = cloneLevelSource(state.source, id);
      options.dispatch({ type: 'load-source', source: cloned });
      window.location.hash = `#${id}`;
    };
    actionRow.appendChild(cloneBtn);
    container.appendChild(actionRow);

    if (isCampaignId(currentId)) {
      const campWriteRow = document.createElement('div');
      campWriteRow.style.marginBottom = '16px';

      const campWriteBtn = document.createElement('button');
      campWriteBtn.textContent = 'Ghi về campaign';
      campWriteBtn.style.width = '100%';
      campWriteBtn.style.padding = '8px';
      campWriteBtn.style.borderRadius = '4px';
      campWriteBtn.style.border = '1px solid #0284c7';
      campWriteBtn.style.backgroundColor = '#0369a1';
      campWriteBtn.style.color = '#ffffff';
      campWriteBtn.style.fontSize = '12px';
      campWriteBtn.style.fontWeight = 'bold';
      campWriteBtn.style.cursor = 'pointer';
      campWriteBtn.title = `Ghi đè nội dung đang soạn về màn campaign ${currentId}`;

      campWriteBtn.onclick = async () => {
        const ok = window.confirm(
          [
            `Ghi đè màn ${currentId} trong campaign?`,
            '',
            `• File nguồn src/content/sources/${currentId}.ts sẽ bị ghi đè`,
            '• contentRevision tăng một bậc',
            '• Trạng thái hạ từ approved về validated',
            '• Màn phải được chơi và duyệt lại trước khi phát hành',
          ].join('\n')
        );
        if (!ok) return;

        campWriteBtn.disabled = true;
        campWriteBtn.textContent = 'Đang ghi...';
        try {
          const res = await promoteStudioLevelApi(state.source.id, currentId, true);
          if (res.ok) {
            const commentMsg = res.preservedComment ? '\n• Giữ nguyên khối chú thích đầu file nguồn' : '';
            alert(
              `Đã ghi về campaign thành công!\n• ID: ${res.targetId}\n• Số file cập nhật: ${res.writtenFiles.length}\n• Trạng thái: validated${commentMsg}`
            );
            await refresh();
          } else {
            const issuesMsg = res.issues && res.issues.length > 0 ? `\nChi tiết:\n${res.issues.map((i) => `${i.field}: ${i.code}`).join('\n')}` : '';
            alert(`Lỗi khi ghi về campaign: ${res.error}${issuesMsg}`);
          }
        } catch (err) {
          alert(`Lỗi kết nối khi ghi về campaign: ${(err as Error).message}`);
        } finally {
          campWriteBtn.disabled = false;
          campWriteBtn.textContent = 'Ghi về campaign';
        }
      };

      campWriteRow.appendChild(campWriteBtn);
      container.appendChild(campWriteRow);
    }

    // Studio Levels Section
    const studioSection = document.createElement('div');
    studioSection.style.marginBottom = '20px';

    const studioHeading = document.createElement('div');
    studioHeading.textContent = `MÀN STUDIO (${studioLevels.length})`;
    studioHeading.style.fontSize = '12px';
    studioHeading.style.fontWeight = 'bold';
    studioHeading.style.color = '#94a3b8';
    studioHeading.style.marginBottom = '8px';
    studioSection.appendChild(studioHeading);

    if (studioLevels.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Chưa có màn studio nào';
      empty.style.fontSize = '12px';
      empty.style.color = '#64748b';
      empty.style.fontStyle = 'italic';
      studioSection.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '4px';

      studioLevels.forEach((lvl) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.padding = '8px 10px';
        item.style.borderRadius = '4px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '13px';

        const isCurrent = lvl.id === currentId;
        if (isCurrent) {
          item.style.backgroundColor = '#1e294b';
          item.style.borderLeft = '3px solid #38bdf8';
        } else {
          item.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        }

        const info = document.createElement('div');
        info.style.overflow = 'hidden';
        info.style.textOverflow = 'ellipsis';
        info.style.whiteSpace = 'nowrap';
        info.textContent = `${lvl.id} ${isCurrent && dirty ? '●' : ''}`;
        item.appendChild(info);

        const del = document.createElement('button');
        del.textContent = '✕';
        del.title = 'Xoá màn studio';
        del.style.background = 'none';
        del.style.border = 'none';
        del.style.color = '#ef4444';
        del.style.cursor = 'pointer';
        del.style.padding = '0 4px';
        del.onclick = async (e) => {
          e.stopPropagation();
          if (confirm(`Bạn có chắc muốn xoá màn studio "${lvl.id}"?`)) {
            await deleteStudioLevelApi(lvl.id);
            await refresh();
          }
        };
        item.appendChild(del);

        item.onclick = async () => {
          try {
            const doc = await fetchStudioLevelDoc(lvl.id);
            const source = sourceFromDocument(doc);
            options.dispatch({ type: 'load-source', source });
            window.location.hash = `#${lvl.id}`;
          } catch (err) {
            alert(`Lỗi khi mở màn ${lvl.id}: ${(err as Error).message}`);
          }
        };

        list.appendChild(item);
      });
      studioSection.appendChild(list);
    }
    container.appendChild(studioSection);

    // Campaign Levels Section
    const campSection = document.createElement('div');
    const campHeading = document.createElement('div');
    campHeading.textContent = 'MÀN CAMPAIGN (Tham khảo)';
    campHeading.style.fontSize = '12px';
    campHeading.style.fontWeight = 'bold';
    campHeading.style.color = '#94a3b8';
    campHeading.style.marginBottom = '8px';
    campSection.appendChild(campHeading);

    const campList = document.createElement('div');
    campList.style.display = 'flex';
    campList.style.flexDirection = 'column';
    campList.style.gap = '4px';

    campaignManifest.forEach((entry) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '6px 10px';
      item.style.borderRadius = '4px';
      item.style.fontSize = '12px';
      item.style.backgroundColor = 'rgba(255, 255, 255, 0.01)';
      item.style.color = entry.status === 'planned' ? '#64748b' : '#cbd5e1';

      const label = document.createElement('span');
      label.textContent = `Màn ${entry.id}`;
      item.appendChild(label);

      const statusTag = document.createElement('span');
      statusTag.textContent = entry.status;
      statusTag.style.fontSize = '10px';
      statusTag.style.padding = '2px 4px';
      statusTag.style.borderRadius = '3px';
      if (entry.status === 'approved') {
        statusTag.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        statusTag.style.color = '#4ade80';
      } else if (entry.status === 'validated') {
        statusTag.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
        statusTag.style.color = '#38bdf8';
      } else {
        statusTag.style.backgroundColor = 'rgba(100, 116, 139, 0.2)';
        statusTag.style.color = '#94a3b8';
      }
      item.appendChild(statusTag);

      if (entry.status !== 'planned') {
        item.style.cursor = 'pointer';
        item.onclick = async () => {
          try {
            const res = await fetch(`/src/content/levels/${entry.id}.json`);
            if (res.ok) {
              const doc = await res.json();
              const source = sourceFromDocument(doc);
              options.dispatch({ type: 'load-source', source });
              window.location.hash = `#${entry.id}`;
            }
          } catch (err) {
            console.warn(err);
          }
        };
      }

      campList.appendChild(item);
    });
    campSection.appendChild(campList);
    container.appendChild(campSection);
  }

  void refresh();

  return {
    element: container,
    refresh,
    render,
  };
}
