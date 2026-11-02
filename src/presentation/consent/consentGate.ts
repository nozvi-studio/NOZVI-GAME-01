import type { PrivacyPurpose, PrivacyState } from '../../application/privacyChoices.ts';
import type { CommonTranslationKey } from '../../localization/types.ts';
import { COLOR_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { t } from '../i18n.ts';
import { openExternal } from '../openExternal.ts';
import { choicesFor } from './consentModel.ts';
import type { ConsentAction } from './consentModel.ts';

export type ConsentGateOptions = {
  offered: readonly PrivacyPurpose[];
  policyUrl?: string;
  doc?: Document;
  translate?: (key: CommonTranslationKey) => string;
  /** Opens the policy link; defaults to openExternal. */
  open?: (url: string) => void;
};

/** First-launch DOM dialog, shown before Phaser starts. Both actions allow play. */
export function requestPrivacyChoices(options: ConsentGateOptions): Promise<PrivacyState> {
  const doc = options.doc ?? document;
  const tr = options.translate ?? t;
  const { offered } = options;
  // Same candy face, outline and lower shadow as HintDialog's primary button.
  const buttonCss =
    'box-sizing:border-box;width:100%;min-width:0;min-height:56px;padding:10px 12px;' +
    'border-radius:20px;border:2.5px solid #3B2779;' +
    'background:linear-gradient(to bottom,#FFD54F 0%,#FFD54F 65%,#FFA800 65%,#FFA800 100%);' +
    'box-shadow:0 5px 0 #22145A;color:#22145A;cursor:pointer;' +
    `font-family:${TYPO_TOKENS.fontFamily.display};font-size:18px;font-weight:700;line-height:1.3;` +
    'text-align:center;overflow-wrap:anywhere;';

  return new Promise((resolve) => {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      if (id) node.setAttribute('data-id', id);
      return node;
    };

    const overlay = el('div', 'consent-gate');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'privacy-title');
    // Auto margins center a fitting card, but collapse to zero when it overflows,
    // keeping its title reachable by scrolling on short screens.
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
      'box-sizing:border-box;padding:16px;overflow-y:auto;text-align:center;' +
      `background:linear-gradient(rgba(5,10,26,0.65),rgba(5,10,26,0.65)),${COLOR_TOKENS.sky.stops[0]};` +
      `color:${COLOR_TOKENS.text.primary};font-family:${TYPO_TOKENS.fontFamily.sans};`;

    const responsive = el('style');
    responsive.textContent =
      '[data-id="consent-gate"] [data-id="actions"]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;grid-auto-rows:1fr;}' +
      '@media(max-width:359px){[data-id="consent-gate"] [data-id="actions"]{grid-template-columns:minmax(0,1fr);}}';

    const card = el('div', 'card');
    card.style.cssText =
      'box-sizing:border-box;flex:none;width:100%;max-width:560px;margin:auto;padding:5px;' +
      'background:rgba(19,27,77,0.98);border:3.5px solid #7FD8FF;border-radius:28px;' +
      'box-shadow:4px 8px 28px rgba(5,10,26,0.65);';
    const content = el('div');
    content.style.cssText =
      'display:flex;flex-direction:column;gap:20px;padding:clamp(16px,4vw,28px);' +
      'border:1.2px solid rgba(255,210,63,0.45);border-radius:22px;';

    const title = el('h1', 'privacy-title');
    title.setAttribute('id', 'privacy-title');
    title.textContent = tr('privacy_title');
    title.style.cssText =
      `margin:0;font-family:${TYPO_TOKENS.fontFamily.display};font-size:28px;line-height:1.25;` +
      'color:#FFD23F;text-shadow:0 2px 0 #22145A;overflow-wrap:anywhere;';

    const bullets = el('ul', 'bullets');
    bullets.style.cssText =
      'display:flex;flex-direction:column;gap:12px;margin:0;padding-left:22px;text-align:left;font-size:16px;line-height:1.5;';
    const bulletKeys: CommonTranslationKey[] = ['privacy_bullet_play'];
    if (offered.includes('analytics')) bulletKeys.push('privacy_bullet_analytics');
    if (offered.includes('diagnostics')) bulletKeys.push('privacy_bullet_diagnostics');
    for (const key of bulletKeys) {
      const bullet = el('li', key);
      bullet.textContent = tr(key);
      bullets.append(bullet);
    }

    const hint = el('p', 'settings-hint');
    hint.textContent = tr('privacy_settings_hint');
    hint.style.cssText = 'margin:0;font-size:13px;line-height:1.5;';
    content.append(title, bullets, hint);

    if (options.policyUrl) {
      const policy = el('a', 'policy');
      policy.href = options.policyUrl;
      policy.setAttribute('target', '_blank');
      policy.setAttribute('rel', 'noopener');
      const policyUrl = options.policyUrl;
      // Keep an accessible href without navigating the startup WebView away.
      policy.addEventListener('click', (event: Event) => {
        event.preventDefault();
        (options.open ?? openExternal)(policyUrl);
      });
      policy.textContent = tr('privacy_policy');
      policy.style.cssText = 'align-self:center;color:#7FD8FF;font-size:14px;line-height:1.5;';
      content.append(policy);
    }

    const finish = (action: ConsentAction): void => {
      overlay.remove();
      resolve(choicesFor(action, offered, {}));
    };
    const row = el('div', 'actions');
    const reject = el('button', 'reject');
    reject.type = 'button';
    reject.textContent = tr('privacy_reject_play');
    reject.style.cssText = buttonCss;
    reject.addEventListener('click', () => finish('reject_all'));
    const accept = el('button', 'accept');
    accept.type = 'button';
    accept.textContent = tr('privacy_accept_play');
    accept.style.cssText = buttonCss;
    accept.addEventListener('click', () => finish('accept_all'));
    row.append(reject, accept);
    content.append(row);
    card.append(content);
    overlay.append(responsive, card);
    doc.body.appendChild(overlay);
    reject.focus?.();
  });
}
