import type { PrivacyPurpose, PrivacyState } from '../../application/privacyChoices.ts';
import type { CommonTranslationKey } from '../../localization/types.ts';
import { t } from '../i18n.ts';
import { choicesFor } from './consentModel.ts';
import type { ConsentAction } from './consentModel.ts';

export type ConsentGateOptions = {
  offered: readonly PrivacyPurpose[];
  policyUrl?: string;
  doc?: Document;
  translate?: (key: CommonTranslationKey) => string;
};

const BUTTON_CSS =
  'flex:1;min-width:140px;min-height:52px;border-radius:26px;font-size:17px;font-weight:700;' +
  'border:2px solid #7FD8FF;background:#273677;color:#FFFFFF;';

const LABELS: Record<PrivacyPurpose, [CommonTranslationKey, CommonTranslationKey]> = {
  analytics: ['privacy_analytics', 'privacy_analytics_desc'],
  diagnostics: ['privacy_diagnostics', 'privacy_diagnostics_desc'],
};

/**
 * Lớp phủ DOM lúc khởi động, trước khi Phaser chạy. "Từ chối tất cả" và "Đồng ý tất cả" ngang hàng;
 * "Tùy chọn" mở công tắc từng mục. Lựa chọn nào cũng cho vào game.
 */
export function requestPrivacyChoices(options: ConsentGateOptions): Promise<PrivacyState> {
  const doc = options.doc ?? document;
  const tr = options.translate ?? t;
  const { offered } = options;

  return new Promise((resolve) => {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      if (id) node.setAttribute('data-id', id);
      return node;
    };

    const overlay = el('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:20px;padding:32px;background:#1A2470;color:#fff;text-align:center;' +
      "font-family:'Be Vietnam Pro',sans-serif;overflow-y:auto;";

    const title = el('h1');
    title.textContent = tr('privacy_title');
    title.style.cssText = 'margin:0;font-size:24px;color:#FFD23F;';

    const intro = el('p');
    intro.textContent = tr('privacy_intro');
    intro.style.cssText = 'max-width:440px;margin:0;font-size:16px;line-height:1.5;';

    overlay.append(title, intro);

    if (options.policyUrl) {
      const policy = el('a', 'policy');
      policy.href = options.policyUrl;
      policy.setAttribute('target', '_blank');
      policy.setAttribute('rel', 'noopener');
      policy.textContent = tr('privacy_policy');
      policy.style.cssText = 'color:#7FD8FF;font-size:15px;';
      overlay.append(policy);
    }

    const finish = (action: ConsentAction, switches: Partial<PrivacyState> = {}): void => {
      overlay.remove();
      resolve(choicesFor(action, offered, switches));
    };

    const row = el('div');
    row.style.cssText = 'display:flex;gap:12px;width:100%;max-width:440px;';
    const reject = el('button', 'reject');
    reject.type = 'button';
    reject.textContent = tr('privacy_reject_all');
    reject.style.cssText = BUTTON_CSS;
    reject.addEventListener('click', () => finish('reject_all'));
    const accept = el('button', 'accept');
    accept.type = 'button';
    accept.textContent = tr('privacy_accept_all');
    accept.style.cssText = BUTTON_CSS;
    accept.addEventListener('click', () => finish('accept_all'));
    row.append(reject, accept);

    const panel = el('div', 'options-panel');
    panel.hidden = true;
    panel.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%;max-width:440px;text-align:left;';
    const switches: Partial<Record<PrivacyPurpose, HTMLInputElement>> = {};
    for (const purpose of offered) {
      const [labelKey, descKey] = LABELS[purpose];
      const label = el('label');
      label.style.cssText = 'display:flex;gap:12px;align-items:flex-start;font-size:16px;';
      const input = el('input', `switch-${purpose}`);
      input.type = 'checkbox';
      input.checked = false;
      input.style.cssText = 'width:24px;height:24px;flex:none;';
      const text = el('span');
      text.textContent = `${tr(labelKey)}: ${tr(descKey)}`;
      label.append(input, text);
      panel.append(label);
      switches[purpose] = input;
    }
    const save = el('button', 'save');
    save.type = 'button';
    save.textContent = tr('privacy_save');
    save.style.cssText = BUTTON_CSS;
    save.addEventListener('click', () =>
      finish('save', {
        analytics: switches.analytics?.checked === true,
        diagnostics: switches.diagnostics?.checked === true,
      })
    );
    panel.append(save);

    const optionsToggle = el('button', 'options');
    optionsToggle.type = 'button';
    optionsToggle.textContent = `${tr('privacy_options')} ▾`;
    optionsToggle.style.cssText = 'background:none;border:0;color:#7FD8FF;font-size:16px;min-height:48px;';
    optionsToggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
    });

    overlay.append(row, optionsToggle, panel);
    doc.body.appendChild(overlay);
  });
}
