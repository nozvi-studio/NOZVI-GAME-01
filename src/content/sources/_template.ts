import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

/**
 * File mẫu cho `npm run content:new -- <id>` khi không có `--from`.
 * KHÔNG đăng ký trong LEVEL_SOURCES. Lệnh tạo màn tự đổi id, title, chapter,
 * order, contentRevision và tên hằng; các trường còn lại sửa tay rồi chạy
 * `npm run content:author -- <id>` để sinh JSON, SVG và báo cáo nghiệm.
 * Hướng dẫn đầy đủ: docs/content/level-kit.md.
 */
export const levelTemplate: LevelSource = {
  // Mã màn "<chương>-<số thứ tự>", trùng tên file nguồn. Ví dụ: '3-11'.
  id: 'mau-1',
  // Tên hiển thị tiếng Việt có dấu, 2–5 chữ; sinh ra tên hằng và slug. Ví dụ: 'Ngọn Nến'.
  title: 'Màn Mẫu',
  // Chương 1–4: 1 ghép cạnh không chồng, 2 chồng lớp chẵn lẻ, 3 Họa Phẩm, 4 xoay. Ví dụ: 3.
  chapter: 1,
  // Thứ tự trong campaign, 1–28 với màn có trong manifest. Ví dụ: 16 cho 3-4.
  order: 99,
  // Phiên bản nội dung "<slug không dấu>-v<n>"; tăng n mỗi lần sửa sau duyệt. Ví dụ: 'ngon-nen-v1'.
  contentRevision: 'man-mau-v1',
  // Chỉ chương 3 được true; chương khác bật xoay thì validator báo chapter-rotation-disabled.
  rotationEnabled: false,
  // Danh sách mảnh, dựng bằng hàm ghép hình của src/content/kit.ts:
  //   piece(id, hình, khung, [tâm x, tâm y], { orientation, decoys })
  //   hình: 'square' | 'triangle' | 'diamond' | 'circle' | 'parallelogram'
  //   khung: theo bảng hình (vuông bội 8, thoi/tròn/mái bội 16, bình hành bội 48; tối đa 128)
  //   tâm: gốc khung = tâm − khung/2 phải là bội của 8. Tâm bàn là [64, 80].
  //   decoys: độ lệch neo nhiễu so với neo A, ví dụ NUDGE, CROSS hoặc [[8, 0]].
  // Ví dụ: piece('C1', 'circle', 32, [64, 80], { decoys: NUDGE }).
  pieces: [piece('S1', 'square', 48, [64, 80], { decoys: [[8, 0]] })],
  // Nghiệm mẫu: mỗi mảnh một bước, anchorId 'A'; turns 1–3 chỉ dùng ở chương 3 (mảnh đối xứng như vuông, thoi, tròn chỉ nhận turns 0).
  // Ví dụ: [[{ pieceId: 'C1', anchorId: 'A', turns: 0 }]].
  sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
  // Một câu nói màn dạy gì. Ví dụ: 'Làm quen hình tròn và vùng giao cong'.
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  // Độ khó ước lượng 1–5. Ví dụ: 3.
  difficultyEstimate: 1,
  // Tư thế gây nhiễu có chủ đích { pieceId, anchorId, reason }; neo bị luật KIT-03 bỏ thì dòng đó cũng bị bỏ.
  // Ví dụ: { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' }.
  distractors: [{ pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' }],
  // Bước hướng dẫn: trigger 'idle' | 'first-snap' | 'two-layers' | 'three-layers',
  // end 'drag-start' | 'snap' | 'two-layers' | 'three-layers'. Để [] nếu không cần.
  // Ví dụ: [{ id: 'drag-first', trigger: 'idle', end: 'drag-start', text: 'Kéo mảnh vào bóng mục tiêu' }].
  ftueSteps: [],
};
