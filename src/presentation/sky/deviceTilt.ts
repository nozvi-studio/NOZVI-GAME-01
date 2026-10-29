import { isReducedMotion } from '../transitions/motion.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Quản lý cảm biến con quay hồi chuyển (DeviceOrientation) và chuột máy tính
 * để tạo hiệu ứng nghiêng Parallax 3D mượt mà khi lắc hoặc nghiêng điện thoại.
 */
class DeviceTiltManager {
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private hasSensorData = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    const onOrientation = (event: DeviceOrientationEvent): void => {
      if (isReducedMotion()) return;
      if (event.gamma === null || event.beta === null) return;
      this.hasSensorData = true;

      // gamma: nghiêng trái/phải [-90, 90]. Thường nghiêng tay trong khoảng ±35 độ.
      const rawGamma = clamp(event.gamma, -40, 40);
      this.targetX = rawGamma / 40;

      // beta: nghiêng trước/sau [-180, 180]. Tư thế cầm điện thoại tự nhiên ~45 độ.
      const naturalPitch = 45;
      const rawBeta = clamp(event.beta - naturalPitch, -40, 40);
      this.targetY = rawBeta / 40;
    };

    try {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
    } catch {
      // Bỏ qua nếu môi trường không hỗ trợ
    }
  }

  /**
   * Cập nhật từ con trỏ chuột/touch trên máy tính hoặc khi chưa có cảm biến
   */
  public setPointer(normalizedX: number, normalizedY: number): void {
    if (this.hasSensorData) return; // Ưu tiên cảm biến xoay thật của điện thoại
    this.targetX = clamp(normalizedX, -1, 1);
    this.targetY = clamp(normalizedY, -1, 1);
  }

  /**
   * Cập nhật nội suy êm ái (damping lerp) theo từng khung hình deltaMs
   */
  public update(deltaMs: number): void {
    if (isReducedMotion()) {
      this.currentX = 0;
      this.currentY = 0;
      return;
    }
    // Hệ số làm mềm êm ái: quán tính nhẹ nhàng như nổi trong chất lỏng
    const factor = Math.min(1, deltaMs * 0.006);
    this.currentX += (this.targetX - this.currentX) * factor;
    this.currentY += (this.targetY - this.currentY) * factor;
  }

  /**
   * Lấy độ lệch chuẩn hóa hiện tại [-1, 1]
   */
  public getTilt(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  /** Dùng cho unit tests */
  public resetForTesting(x = 0, y = 0): void {
    this.targetX = x;
    this.targetY = y;
    this.currentX = x;
    this.currentY = y;
    this.hasSensorData = false;
  }
}

export const deviceTilt = new DeviceTiltManager();
