/**
 * Cầu nối giữa màn hình thật và hệ toạ độ thiết kế 720x1280.
 *
 * Thuần, không import Phaser, nên vitest nạp được trực tiếp.
 *
 * Bối cảnh: Phaser 3 không nhân `devicePixelRatio` cho canvas. Để mặc định thì
 * bộ đệm vẽ đúng 720x1280 rồi bị CSS kéo lên 1080 pixel vật lý — mọi nét đều
 * qua một lần nội suy. Ta tự đặt bộ đệm bằng đúng số pixel vật lý, rồi trả hệ
 * toạ độ thiết kế lại cho scene bằng camera zoom.
 */

/** Bề ngang hệ toạ độ thiết kế. Mọi scene vẫn vẽ trong khung này. */
export const DESIGN_WIDTH = 720;

/** Bề cao hệ toạ độ thiết kế. */
export const DESIGN_HEIGHT = 1280;

/**
 * Chặn trên của devicePixelRatio.
 *
 * Máy 4K báo dpr 4 trở lên; nhân nguyên si thì bộ đệm vượt 30 triệu pixel,
 * tốn VRAM và tụt khung hình mà mắt không phân biệt nổi. 3 đã vượt ngưỡng
 * nhận biết trên màn điện thoại.
 */
export const MAX_DPR = 3;

export type Viewport = {
  /** Bề ngang vùng hiển thị theo pixel CSS */
  cssWidth: number;
  /** Bề cao vùng hiển thị theo pixel CSS */
  cssHeight: number;
  /** devicePixelRatio đã kẹp về [1, MAX_DPR] */
  dpr: number;
  /** Bề ngang bộ đệm vẽ, tính bằng pixel vật lý */
  bufferWidth: number;
  /** Bề cao bộ đệm vẽ, tính bằng pixel vật lý */
  bufferHeight: number;
  /** Hệ số quy đổi một đơn vị thiết kế ra bao nhiêu pixel vật lý */
  designScale: number;
};

/**
 * Quy đổi kích thước hiển thị thành thông số bộ đệm.
 *
 * Tách khỏi `readViewport` để test được mà không cần `window`.
 */
export function computeViewport(cssWidth: number, cssHeight: number, rawDpr: number): Viewport {
  const safeCssHeight = cssHeight > 0 ? cssHeight : DESIGN_HEIGHT;
  // Giới hạn bề ngang tối đa theo tỉ lệ thiết kế 720:1280 (9:16).
  // Trên màn ngang (desktop/web), game giữ tỉ lệ chân dung chuẩn, nằm giữa màn hình
  // thay vì bị bè ngang và ép chiều cao thiết kế xuống thấp làm UI bị phóng đại quá mức.
  const maxPortraitWidth = safeCssHeight * (DESIGN_WIDTH / DESIGN_HEIGHT);
  const rawCssWidth = cssWidth > 0 ? cssWidth : DESIGN_WIDTH;
  const safeCssWidth = Math.min(rawCssWidth, maxPortraitWidth);
  const dpr = clamp(Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1, 1, MAX_DPR);

  // Làm tròn: bộ đệm lẻ nửa pixel khiến canvas bị nội suy lại đúng thứ ta đang tránh.
  const bufferWidth = Math.round(safeCssWidth * dpr);
  const bufferHeight = Math.round(safeCssHeight * dpr);

  return {
    cssWidth: safeCssWidth,
    cssHeight: safeCssHeight,
    dpr,
    bufferWidth,
    bufferHeight,
    designScale: bufferWidth / DESIGN_WIDTH,
  };
}

/** Đọc kích thước thật của cửa sổ. Chỉ gọi được trong trình duyệt. */
export function readViewport(): Viewport {
  return computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio);
}

/** Vùng toạ độ thiết kế mà camera nhìn thấy. Luôn bắt đầu tại gốc. */
export type DesignView = { x: 0; y: 0; width: number; height: number };

/**
 * Chiều cao hệ toạ độ thiết kế trên máy này.
 *
 * Bề ngang cố định 720 nên bàn chơi, `cellPixel` và mọi toạ độ ngang giữ
 * nguyên; chỉ chiều cao chạy theo tỉ lệ màn thật. Máy 9:16 ra đúng 1280, máy
 * 9:21 ra khoảng 1640 — phần dôi ra là không gian thật để bố cục dùng, không
 * phải viền.
 */
export function computeDesignHeight(bufferWidth: number, bufferHeight: number): number {
  if (bufferWidth <= 0 || bufferHeight <= 0) return DESIGN_HEIGHT;
  return (bufferHeight * DESIGN_WIDTH) / bufferWidth;
}

/** Khung toạ độ thiết kế đầy đủ của máy này. */
export function computeDesignView(bufferWidth: number, bufferHeight: number): DesignView {
  return {
    x: 0,
    y: 0,
    width: DESIGN_WIDTH,
    height: computeDesignHeight(bufferWidth, bufferHeight),
  };
}

/** Lề an toàn theo đơn vị thiết kế: notch, camera đục lỗ, vùng vuốt cử chỉ. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };

export const NO_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Quy đổi lề an toàn từ pixel CSS sang đơn vị thiết kế.
 *
 * Trình duyệt báo `env(safe-area-inset-*)` theo pixel CSS, còn bố cục làm việc
 * trong hệ 720 đơn vị, nên phải chia theo tỉ lệ bề ngang.
 */
export function safeAreaToDesignUnits(
  insetsCssPx: SafeArea,
  cssWidth: number
): SafeArea {
  if (cssWidth <= 0) return NO_SAFE_AREA;
  const k = DESIGN_WIDTH / cssWidth;
  return {
    top: Math.max(0, insetsCssPx.top) * k,
    right: Math.max(0, insetsCssPx.right) * k,
    bottom: Math.max(0, insetsCssPx.bottom) * k,
    left: Math.max(0, insetsCssPx.left) * k,
  };
}

/**
 * Đọc `env(safe-area-inset-*)` bằng một phần tử dò.
 *
 * Không có API JS nào trả thẳng các giá trị này; cách duy nhất là gán chúng
 * vào một thuộc tính CSS rồi đọc lại giá trị đã tính. Cần `viewport-fit=cover`
 * trong index.html, nếu không trình duyệt luôn báo 0.
 */
export function readSafeAreaCssPx(): SafeArea {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'top:env(safe-area-inset-top,0px)',
    'right:env(safe-area-inset-right,0px)',
    'bottom:env(safe-area-inset-bottom,0px)',
    'left:env(safe-area-inset-left,0px)',
  ].join(';');
  document.body.appendChild(probe);

  const computed = getComputedStyle(probe);
  const insets: SafeArea = {
    top: Number.parseFloat(computed.top) || 0,
    right: Number.parseFloat(computed.right) || 0,
    bottom: Number.parseFloat(computed.bottom) || 0,
    left: Number.parseFloat(computed.left) || 0,
  };

  probe.remove();
  return insets;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
