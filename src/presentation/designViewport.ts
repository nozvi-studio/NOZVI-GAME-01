import Phaser from 'phaser';
import {
  computeDesignView,
  readSafeAreaCssPx,
  safeAreaToDesignUnits,
  DESIGN_WIDTH,
  NO_SAFE_AREA,
} from './viewport.ts';
import type { DesignView, SafeArea } from './viewport.ts';

/**
 * Nối hệ toạ độ thiết kế vào một scene.
 *
 * Bộ đệm vẽ của game bằng số pixel vật lý (xem `viewport.ts`), nên nếu scene vẽ
 * thẳng vào đó thì mọi toạ độ 720 đơn vị sẽ nằm gọn ở góc trên trái. Camera zoom
 * đưa hệ toạ độ thiết kế trở lại: scene vẫn viết `360` là giữa màn, còn phần
 * rasterise diễn ra ở độ phân giải thiết bị.
 *
 * Bề ngang luôn là 720; chiều cao chạy theo tỉ lệ màn thật, nên camera nhìn
 * trọn khung từ (0,0) tới (720, designHeight) — không còn khái niệm viền.
 *
 * Gọi ở đầu `create()` của mọi scene, trước khi tạo đối tượng.
 */
export function applyDesignViewport(scene: Phaser.Scene): number {
  const designScale = scene.scale.width / DESIGN_WIDTH;
  const view = designViewBounds(scene);
  const camera = scene.cameras.main;

  camera.setZoom(designScale);
  camera.centerOn(view.width / 2, view.height / 2);

  installCrispText(scene, designScale);

  return designScale;
}

/**
 * Khung toạ độ thiết kế của scene, suy ra từ kích thước bộ đệm.
 *
 * Suy ra từ bộ đệm chứ không đọc `camera.worldView`, vì worldView chỉ được cập
 * nhật ở lần preRender đầu tiên — tức là sau `create()`.
 */
export function designViewBounds(scene: Phaser.Scene): DesignView {
  return computeDesignView(scene.scale.width, scene.scale.height);
}

/**
 * Lề an toàn của máy, quy sang đơn vị thiết kế.
 *
 * Đọc một lần rồi nhớ lại: phép dò phải chèn phần tử vào DOM và buộc trình
 * duyệt tính lại style, không nên lặp ở mỗi lần chuyển scene.
 */
let cachedSafeArea: SafeArea | null = null;

export function designSafeArea(scene: Phaser.Scene): SafeArea {
  if (cachedSafeArea) return cachedSafeArea;
  if (typeof document === 'undefined') return NO_SAFE_AREA;

  const cssWidth = scene.scale.width / (window.devicePixelRatio || 1);
  cachedSafeArea = safeAreaToDesignUnits(readSafeAreaCssPx(), cssWidth);
  return cachedSafeArea;
}

/** Chỉ dùng trong test. */
export function resetSafeAreaCache(): void {
  cachedSafeArea = null;
}

/**
 * Buộc mọi `scene.add.text` rasterise ở độ phân giải thiết bị.
 *
 * Phaser dựng chữ thành texture ở đúng cỡ font rồi mới để camera phóng lên, nên
 * nếu không nâng `resolution` thì chữ là thứ nhòe rõ nhất trên máy dpr cao.
 * Ghi đè factory một lần ở đây thay vì sửa 41 chỗ gọi `.text(...)`; mỗi scene có
 * một GameObjectFactory riêng nên việc ghi đè không rò sang scene khác.
 */
function installCrispText(scene: Phaser.Scene, resolution: number): void {
  const factory = scene.add;
  const original = factory.text.bind(factory);

  factory.text = ((
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ) => original(x, y, text, { resolution, ...style })) as typeof factory.text;
}
