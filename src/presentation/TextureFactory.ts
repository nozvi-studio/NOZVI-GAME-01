import type Phaser from 'phaser';
import { COLOR_TOKENS, GLASS_TOKENS, LAYOUT_TOKENS, VICTORY_CARD } from './designTokens.ts';

/**
 * Cung tròn có đầu mũi tên.
 *
 * Mũi tên được tính từ điểm cuối của cung và hướng tiếp tuyến tại đó, nên luôn
 * dính vào đường cung dù đổi bán kính hay góc.
 */
function strokeArcArrow(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  anticlockwise: boolean
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(cx, cy, r, from, to, anticlockwise);
  ctx.stroke();

  const px = cx + r * Math.cos(to);
  const py = cy + r * Math.sin(to);
  const dir = anticlockwise ? -1 : 1;
  const tx = -Math.sin(to) * dir;
  const ty = Math.cos(to) * dir;
  const nx = -ty;
  const ny = tx;
  const head = 5.5;
  const half = 4.6;

  ctx.beginPath();
  ctx.moveTo(px + tx * head, py + ty * head);
  ctx.lineTo(px - tx * 1.5 + nx * half, py - ty * 1.5 + ny * half);
  ctx.lineTo(px - tx * 1.5 - nx * half, py - ty * 1.5 - ny * half);
  ctx.closePath();
  ctx.fill();
}

export const TEXTURE_KEYS = {
  steleBorder: 'stele_border_9slice',
  glassFrameBoard: 'glass_frame_board',
  glassFrameTray: 'glass_frame_tray',
  goldFrameBoard: 'gold_frame_board',
  victoryCardFrame: 'victory_card_frame',
  victoryCardSurface: 'victory_card_surface',
  victoryNextButton: 'victory_next_button',
  boardSurface: 'board_surface',
  trayWell: 'tray_well',
  btnCircle112: 'btn_circle_112',
  btnCircle80: 'btn_circle_80',
  btnCircle64: 'btn_circle_64',
  btnCircle56: 'btn_circle_56',
  btnPrimaryAmber: 'btn_primary_amber',
  iconReset: 'icon_reset',
  iconRotate: 'icon_rotate',
  iconGear: 'icon_gear',
  iconMenuBack: 'icon_menu_back',
  iconEyeOpen: 'icon_eye_open',
  iconEyeClosed: 'icon_eye_closed',
  iconClose: 'icon_close',
  nodeCompleted: 'node_completed',
  nodeCurrent: 'node_current',
  nodeUnlocked: 'node_unlocked',
  nodeLocked: 'node_locked',
  toggleTrackOn: 'toggle_track_on',
  toggleTrackOff: 'toggle_track_off',
  toggleThumb: 'toggle_thumb',
} as const;

export class TextureFactory {
  /**
   * Tạo toàn bộ Canvas Textures một lần lúc khởi động Scene,
   * tránh việc vẽ lại Graphics đắt đỏ trong mỗi frame.
   */
  public static generateAll(scene: Phaser.Scene): void {
    const tm = scene.textures;
    if (!tm) return;

    // 0. Khung kính dùng chung cho bàn chơi và khay mảnh
    TextureFactory.makeGlassFrame(
      scene,
      TEXTURE_KEYS.glassFrameBoard,
      LAYOUT_TOKENS.board.width,
      LAYOUT_TOKENS.board.height,
      LAYOUT_TOKENS.board.cornerRadius
    );
    // Khung vàng khi thắng màn: cùng hình dạng khung kính, đổi bốn chặng màu
    TextureFactory.makeGlassFrame(
      scene,
      TEXTURE_KEYS.goldFrameBoard,
      LAYOUT_TOKENS.board.width,
      LAYOUT_TOKENS.board.height,
      LAYOUT_TOKENS.board.cornerRadius,
      ['#FFF6D6', '#FFD86E', '#F2A93B', '#C77A1F']
    );

    // Thẻ hoàn thành: viền vàng, lòng xanh đậm, nút chính vàng bóng
    TextureFactory.makeGlassFrame(scene, TEXTURE_KEYS.victoryCardFrame, VICTORY_CARD.w, VICTORY_CARD.h, 40, [
      '#FFF6D6', '#FFC857', '#E9A240', '#C9842A',
    ]);
    TextureFactory.makeSurface(scene, TEXTURE_KEYS.victoryCardSurface, {
      width: VICTORY_CARD.w - 12,
      height: VICTORY_CARD.h - 12,
      radius: 34,
      stops: [[0, '#2A3A9E'], [1, '#1A2468']],
    });
    TextureFactory.makeSurface(scene, TEXTURE_KEYS.victoryNextButton, {
      width: VICTORY_CARD.buttons.nextW,
      height: VICTORY_CARD.buttonHeight,
      radius: VICTORY_CARD.buttonHeight / 2,
      stops: [[0, '#FFE29A'], [0.55, '#FFC857'], [1, '#F0A83A']],
    });

    // Mặt bàn: gradient xanh đậm kèm quầng sáng nhẹ ở giữa, như mockup
    TextureFactory.makeSurface(scene, TEXTURE_KEYS.boardSurface, {
      width: LAYOUT_TOKENS.board.width,
      height: LAYOUT_TOKENS.board.height,
      radius: LAYOUT_TOKENS.board.cornerRadius,
      stops: [
        [0, COLOR_TOKENS.board.surfaceTop],
        [1, COLOR_TOKENS.board.surfaceBottom],
      ],
      innerGlow: { color: COLOR_TOKENS.board.innerGlow, alpha: 0.3 },
    });

    // Ô chứa mảnh trong khay: lõm xuống, xanh đậm trong suốt — không phải
    // hộp đen. Khay có hai ô nên mỗi ô rộng nửa khay trừ khe giữa.
    TextureFactory.makeSurface(scene, TEXTURE_KEYS.trayWell, {
      width: LAYOUT_TOKENS.tray.width / 2 - 24,
      height: LAYOUT_TOKENS.tray.height - 28,
      radius: 22,
      stops: [
        [0, 'rgba(10, 20, 70, 0.70)'],
        [1, 'rgba(25, 40, 110, 0.55)'],
      ],
      innerShadow: true,
    });

    TextureFactory.makeGlassFrame(
      scene,
      TEXTURE_KEYS.glassFrameTray,
      LAYOUT_TOKENS.tray.width,
      LAYOUT_TOKENS.tray.height,
      LAYOUT_TOKENS.tray.cornerRadius
    );

    // 0a. Nút tròn chính 112px (Chuẩn 56dp: Đặt lại, Xoay)
    if (!tm.exists(TEXTURE_KEYS.btnCircle112)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.btnCircle112, 112, 112);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.board.surfaceTop;
        ctx.beginPath();
        ctx.arc(56, 56, 52, 0, Math.PI * 2);
        ctx.fill();

        // Viền kính xanh dày 4px
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.primaryBorder;
        ctx.stroke();

        // Highlight cạnh trên
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.beginPath();
        ctx.arc(56, 56, 51, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        // Rãnh bóng tối cạnh dưới
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelShadow;
        ctx.beginPath();
        ctx.arc(56, 56, 51, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();

        // Chỉ vàng hổ phách mảnh bên trong
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLOR_TOKENS.amberGold.gridCoordinate;
        ctx.beginPath();
        ctx.arc(56, 56, 44, 0, Math.PI * 2);
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 0b. Nút tròn phụ 80px (Chuẩn 40dp: Menu, Mắt bóng mẫu)
    if (!tm.exists(TEXTURE_KEYS.btnCircle80)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.btnCircle80, 80, 80);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.board.surfaceTop;
        ctx.beginPath();
        ctx.arc(40, 40, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.primaryBorder;
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.beginPath();
        ctx.arc(40, 40, 35, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelShadow;
        ctx.beginPath();
        ctx.arc(40, 40, 35, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 0c. Icon Mắt mở 36x36 (Bóng mẫu: Bật)
    if (!tm.exists(TEXTURE_KEYS.iconEyeOpen)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconEyeOpen, 36, 36);
      if (canvas) {
        const ctx = canvas.context;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Viền mắt quả hạnh
        ctx.beginPath();
        ctx.moveTo(5, 18);
        ctx.quadraticCurveTo(18, 7, 31, 18);
        ctx.quadraticCurveTo(18, 29, 5, 18);
        ctx.stroke();

        // Đồng tử mắt vàng rực
        ctx.fillStyle = COLOR_TOKENS.amberGold.solidPrimary;
        ctx.beginPath();
        ctx.arc(18, 18, 4.5, 0, Math.PI * 2);
        ctx.fill();

        canvas.refresh();
      }
    }

    // 0d. Icon Mắt gạch chéo 36x36 (Bóng mẫu: Tắt)
    if (!tm.exists(TEXTURE_KEYS.iconEyeClosed)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconEyeClosed, 36, 36);
      if (canvas) {
        const ctx = canvas.context;
        ctx.strokeStyle = COLOR_TOKENS.text.secondary;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Viền mắt mờ
        ctx.beginPath();
        ctx.moveTo(5, 18);
        ctx.quadraticCurveTo(18, 7, 31, 18);
        ctx.quadraticCurveTo(18, 29, 5, 18);
        ctx.stroke();

        // Đồng tử mờ
        ctx.fillStyle = COLOR_TOKENS.text.secondary;
        ctx.beginPath();
        ctx.arc(18, 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // Đường gạch chéo đỏ cam
        ctx.strokeStyle = COLOR_TOKENS.danger.warningText;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(7, 29);
        ctx.lineTo(29, 7);
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 1. Nút tròn 64px (Dùng cho Đặt lại và Xoay)
    if (!tm.exists(TEXTURE_KEYS.btnCircle64)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.btnCircle64, 64, 64);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.board.surfaceTop;
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();

        // Viền kính xanh bevel
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.primaryBorder;
        ctx.stroke();

        // Highlight cạnh trên
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.beginPath();
        ctx.arc(32, 32, 29, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 2. Nút tròn 56px (Dùng cho Menu header và Cài đặt)
    if (!tm.exists(TEXTURE_KEYS.btnCircle56)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.btnCircle56, 56, 56);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.board.surfaceTop;
        ctx.beginPath();
        ctx.arc(28, 28, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.primaryBorder;
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 3. Icon Đặt lại (Reset): bộ đệm 64x64 vẽ theo hệ 32 đơn vị, Hud thu về 0.6 để nét sắc
    if (!tm.exists(TEXTURE_KEYS.iconReset)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconReset, 64, 64);
      if (canvas) {
        const ctx = canvas.context;
        ctx.scale(2, 2);
        // Ngược chiều kim đồng hồ, đầu mũi tên ở trên bên trái.
        strokeArcArrow(ctx, COLOR_TOKENS.text.primary, 16, 16, 9, Math.PI * 0.75, -Math.PI * 0.75, true);
        canvas.refresh();
      }
    }

    // 4. Icon Xoay (Rotate): cùng khung với Reset, quay thuận chiều kim đồng hồ
    if (!tm.exists(TEXTURE_KEYS.iconRotate)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconRotate, 64, 64);
      if (canvas) {
        const ctx = canvas.context;
        ctx.scale(2, 2);
        strokeArcArrow(ctx, COLOR_TOKENS.amberGold.solidPrimary, 16, 16, 9, Math.PI * 0.25, Math.PI * 1.75, false);
        canvas.refresh();
      }
    }

    // 5. Icon Bánh răng cổ ngữ (Gear) 28x28 (Closed outline)
    if (!tm.exists(TEXTURE_KEYS.iconGear)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconGear, 28, 28);
      if (canvas) {
        const ctx = canvas.context;
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Lỗ tròn trung tâm
        ctx.beginPath();
        ctx.arc(14, 14, 4.2, 0, Math.PI * 2);
        ctx.stroke();

        // Đường viền khép kín hình bánh răng 6 răng
        const teeth = 6;
        const rInner = 8.2;
        const rOuter = 11.8;
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
          const a0 = (i * 2 * Math.PI) / teeth - 0.22;
          const a1 = (i * 2 * Math.PI) / teeth + 0.22;
          const aMid = ((i + 0.5) * 2 * Math.PI) / teeth;
          const a2 = aMid - 0.22;
          const a3 = aMid + 0.22;

          const p0x = 14 + Math.cos(a0) * rOuter;
          const p0y = 14 + Math.sin(a0) * rOuter;
          const p1x = 14 + Math.cos(a1) * rOuter;
          const p1y = 14 + Math.sin(a1) * rOuter;
          const p2x = 14 + Math.cos(a2) * rInner;
          const p2y = 14 + Math.sin(a2) * rInner;
          const p3x = 14 + Math.cos(a3) * rInner;
          const p3y = 14 + Math.sin(a3) * rInner;

          if (i === 0) {
            ctx.moveTo(p0x, p0y);
          } else {
            ctx.lineTo(p0x, p0y);
          }
          ctx.lineTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.lineTo(p3x, p3y);
        }
        ctx.closePath();
        ctx.stroke();

        canvas.refresh();
      }
    }

    // 6. Icon Mũi tên quay lại (Back arrow) 28x28
    if (!tm.exists(TEXTURE_KEYS.iconMenuBack)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconMenuBack, 28, 28);
      if (canvas) {
        const ctx = canvas.context;
        ctx.strokeStyle = COLOR_TOKENS.text.primary;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(18, 7);
        ctx.lineTo(11, 14);
        ctx.lineTo(18, 21);
        ctx.stroke();
        canvas.refresh();
      }
    }

    // 7. Icon Đóng (Close) 24x24
    if (!tm.exists(TEXTURE_KEYS.iconClose)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.iconClose, 24, 24);
      if (canvas) {
        const ctx = canvas.context;
        ctx.strokeStyle = COLOR_TOKENS.text.secondary;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(6, 6);
        ctx.lineTo(18, 18);
        ctx.moveTo(18, 6);
        ctx.lineTo(6, 18);
        ctx.stroke();
        canvas.refresh();
      }
    }

    // 8. Node chòm sao
    this.generateNodeTextures(scene);
  }

  private static generateNodeTextures(scene: Phaser.Scene): void {
    const tm = scene.textures;
    if (!tm) return;

    // 1. Completed node 96px (solid amber + bright rim + crisp checkmark)
    if (!tm.exists(TEXTURE_KEYS.nodeCompleted)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.nodeCompleted, 96, 96);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.amberGold.solidPrimary;
        TextureFactory.diamondPath(ctx, 48, 48, 43);
        ctx.fill();

        ctx.strokeStyle = COLOR_TOKENS.amberGold.glowHighlight;
        ctx.lineWidth = 4;
        ctx.stroke();

        // The checkmark is drawn here only as the fallback for a level whose
        // silhouette cannot be built; LevelSelectScene draws the silhouette
        // over it for every level that has one.
        ctx.strokeStyle = COLOR_TOKENS.sky.stops[0];
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(33, 48);
        ctx.lineTo(44, 59);
        ctx.lineTo(65, 37);
        ctx.stroke();
        canvas.refresh();
      }
    }

    // 2. Node Hiện tại 96px (Vành kính xanh + vòng vàng phát quang + tâm rực)
    if (!tm.exists(TEXTURE_KEYS.nodeCurrent)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.nodeCurrent, 96, 96);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = COLOR_TOKENS.board.surfaceTop;
        TextureFactory.diamondPath(ctx, 48, 48, 43);
        ctx.fill();

        // Vành kính xanh
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.primaryBorder;
        ctx.lineWidth = 4.5;
        ctx.stroke();

        // Highlight kính cạnh trên
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(48, 48, 41, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        // Vành vàng phát quang bên trong
        ctx.strokeStyle = COLOR_TOKENS.amberGold.glowHighlight;
        ctx.lineWidth = 3.5;
        TextureFactory.diamondPath(ctx, 48, 48, 33);
        ctx.stroke();

        // Lõi vàng đặc radius 28px để hiển thị số màn rõ nét
        ctx.fillStyle = COLOR_TOKENS.amberGold.solidPrimary;
        TextureFactory.diamondPath(ctx, 48, 48, 28);
        ctx.fill();
        canvas.refresh();
      }
    }

    // 3. Content frontier node 96px: outline only, interior left empty — the
    // level exists in the manifest but has not been built yet.
    if (!tm.exists(TEXTURE_KEYS.nodeUnlocked)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.nodeUnlocked, 96, 96);
      if (canvas) {
        const ctx = canvas.context;
        TextureFactory.diamondPath(ctx, 48, 48, 43);
        ctx.strokeStyle = COLOR_TOKENS.iceGlass.bevelHighlight;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        canvas.refresh();
      }
    }

    // 4. Node Khóa 96px (Mờ tối + Icon ổ khóa chiêm tinh)
    if (!tm.exists(TEXTURE_KEYS.nodeLocked)) {
      const canvas = tm.createCanvas(TEXTURE_KEYS.nodeLocked, 96, 96);
      if (canvas) {
        const ctx = canvas.context;
        ctx.fillStyle = 'rgba(11, 20, 48, 0.7)';
        TextureFactory.diamondPath(ctx, 48, 48, 40);
        ctx.fill();

        ctx.strokeStyle = 'rgba(157, 175, 199, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Quai khóa
        ctx.strokeStyle = COLOR_TOKENS.text.secondary;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(48, 43, 10, Math.PI, 0, false);
        ctx.stroke();

        // Thân khóa
        ctx.fillStyle = COLOR_TOKENS.text.secondary;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(35, 43, 26, 20, 4);
        } else {
          ctx.rect(35, 43, 26, 20);
        }
        ctx.fill();

        // Lỗ khóa
        ctx.fillStyle = COLOR_TOKENS.sky.stops[0];
        ctx.beginPath();
        ctx.arc(48, 51, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(46.5, 51, 3, 5.5);

        canvas.refresh();
      }
    }
  }

  /**
   * Khung kính bao quanh bàn chơi và khay mảnh: gradient băng từ trắng xanh
   * xuống xanh đậm, bo góc, viền tóc trắng mờ ở mép ngoài.
   *
   * Khoét lòng khung để chỉ còn lại dải viền, nên một texture dùng được cho
   * mọi kích thước khung mà không phải vẽ bevel thủ công từng cạnh.
   */
  /**
   * Đường viền hình thoi dùng cho node bản đồ.
   *
   * Mockup dùng thoi chứ không dùng tròn: node phải cùng ngôn ngữ hình học
   * với mảnh ghép trên bàn, nếu không bản đồ trông như game khác.
   */
  private static diamondPath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  public static makeGlassFrame(
    scene: Phaser.Scene,
    key: string,
    width: number,
    height: number,
    radius: number,
    stops: readonly string[] = GLASS_TOKENS.frameStops
  ): string {
    const tm = scene.textures;
    if (!tm || tm.exists(key)) return key;

    const canvas = tm.createCanvas(key, width, height);
    if (!canvas) return key;
    const ctx = canvas.context;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    stops.forEach((stop, index) => {
      gradient.addColorStop(GLASS_TOKENS.frameStopOffsets[index], stop);
    });

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${GLASS_TOKENS.hairline.alpha})`;
    ctx.lineWidth = GLASS_TOKENS.hairline.width;
    ctx.stroke();

    const pad = GLASS_TOKENS.padding;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect(pad, pad, width - pad * 2, height - pad * 2, Math.max(0, radius - pad));
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    canvas.refresh();
    return key;
  }

  /**
   * Bề mặt bo góc có gradient dọc thật, tuỳ chọn quầng sáng giữa và bóng lõm
   * ở mép trên. Dùng cho mặt bàn và ô chứa mảnh trong khay.
   */
  public static makeSurface(
    scene: Phaser.Scene,
    key: string,
    opts: {
      width: number;
      height: number;
      radius: number;
      stops: Array<[number, string]>;
      innerGlow?: { color: string; alpha: number };
      innerShadow?: boolean;
    }
  ): string {
    const tm = scene.textures;
    if (!tm || tm.exists(key)) return key;
    const { width, height, radius } = opts;
    const canvas = tm.createCanvas(key, width, height);
    if (!canvas) return key;
    const ctx = canvas.context;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.clip();

    const fill = ctx.createLinearGradient(0, 0, 0, height);
    for (const [offset, color] of opts.stops) fill.addColorStop(offset, color);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);

    if (opts.innerGlow) {
      const { color, alpha } = opts.innerGlow;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const glow = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.55
      );
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    if (opts.innerShadow) {
      // Bóng đổ vào trong ở mép trên tạo cảm giác ô bị lõm xuống
      const shade = ctx.createLinearGradient(0, 0, 0, 18);
      shade.addColorStop(0, 'rgba(0, 0, 20, 0.6)');
      shade.addColorStop(1, 'rgba(0, 0, 20, 0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, 18);
      // Viền sáng mảnh ở mép dưới
      ctx.fillStyle = 'rgba(160, 220, 255, 0.25)';
      ctx.fillRect(0, height - 1, width, 1);
    }

    ctx.restore();
    canvas.refresh();
    return key;
  }
}
