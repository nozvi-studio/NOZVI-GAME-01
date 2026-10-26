import { grantAnalyticsConsent, isAnalyticsConsentGranted } from '../../infrastructure/analyticsConsent.ts';

export type ConsentGateDeps = {
  isGranted?: () => boolean;
  grant?: () => void;
  doc?: Document;
};

/**
 * PLACEHOLDER: lớp phủ DOM một câu hỏi, một nút, một ngôn ngữ. Chủ dự án sẽ thay giao diện và lời văn thật;
 * chỉ cần giữ hợp đồng: resolve khi người chơi đã đồng ý (hoặc đã đồng ý từ trước).
 */
export function requestAnalyticsConsent(deps: ConsentGateDeps = {}): Promise<void> {
  const isGranted = deps.isGranted ?? (() => isAnalyticsConsentGranted());
  const grant = deps.grant ?? (() => grantAnalyticsConsent());
  if (isGranted()) return Promise.resolve();
  const doc = deps.doc ?? document;

  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:24px;padding:32px;background:#1A2470;color:#fff;text-align:center;' +
      "font-family:'Be Vietnam Pro',sans-serif;";

    const text = doc.createElement('p');
    text.style.cssText = 'max-width:420px;margin:0;font-size:18px;line-height:1.5;';
    text.textContent =
      'Nozvi thu thập dữ liệu chơi ẩn danh (màn bạn chơi, thời gian, số sao) để cải thiện game. ' +
      'Nhấn Đồng ý để tiếp tục.';

    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Đồng ý';
    button.style.cssText =
      'min-width:180px;min-height:48px;border:0;border-radius:24px;font-size:18px;font-weight:700;' +
      'background:#F5C842;color:#1A2470;';
    button.addEventListener('click', () => {
      grant();
      overlay.remove();
      resolve();
    });

    overlay.append(text, button);
    doc.body.appendChild(overlay);
  });
}
