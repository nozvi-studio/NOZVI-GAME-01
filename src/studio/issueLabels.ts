/** Vietnamese labels for validator issue codes in the Studio check panel. */
export const ISSUE_LABELS: Record<string, string> = {
  'chapter-3-needs-rotation': 'Chương 3 cần ít nhất một mảnh xoay trong nghiệm mẫu',
  'chapter-rotation-disabled': 'Chương này không cho xoay nhưng màn đang bật xoay',
  'chapter-rotation-required': 'Chương này bắt buộc xoay nhưng màn đang tắt xoay',
  'drives-degenerate': 'Hai nút liên động giống hệt nhau (cùng nhóm mảnh xoay)',
  'drives-duplicate': 'Danh sách mảnh xoay theo có mảnh trùng',
  'drives-self': 'Mảnh không được xoay theo chính nó',
  'drives-target-unreachable': 'Không đạt được nghiệm mẫu bằng các nút liên động hiện tại',
  'drives-unknown-piece': 'Liên động trỏ tới mảnh không tồn tại',
  'drives-without-rotation': 'Có liên động nhưng màn chưa bật xoay',
  'duplicate-anchor-id': 'Một mảnh có hai neo trùng id',
  'duplicate-piece-id': 'Hai mảnh trùng id',
  'empty-anchors': 'Mảnh chưa có neo nào',
  'empty-cells': 'Mảnh không có ô nào',
  'empty-pieces': 'Màn chưa có mảnh nào',
  'empty-target': 'Hình đích đang trống',
  'free-placement-distractors': 'Đặt tự do không dùng neo nhiễu',
  'free-placement-extra-anchor': 'Đặt tự do chỉ cho một neo A mỗi mảnh',
  'free-placement-off-grid': 'Neo đặt tự do không nằm trên giao điểm lưới',
  'invalid-allow-unproven': 'allowUnproven phải có lý do (reason) là chuỗi không trống',
  'invalid-anchor-coord': 'Toạ độ neo không hợp lệ',
  'invalid-anchor-id': 'Id neo không hợp lệ',
  'invalid-cell-coordinate': 'Toạ độ ô không hợp lệ',
  'invalid-chapter': 'Chương không hợp lệ',
  'invalid-color': 'Màu không hợp lệ',
  'invalid-drives': 'Danh sách mảnh xoay theo không hợp lệ',
  'invalid-frame-for-shape': 'Cỡ khung không hợp cho hình và hướng này',
  'invalid-frame-size': 'Cỡ khung không hợp lệ',
  'invalid-json-root': 'Tài liệu màn không phải một đối tượng',
  'invalid-order': 'Số thứ tự màn không hợp lệ',
  'invalid-orientation': 'Hướng mảnh không hợp lệ',
  'invalid-piece-object': 'Mảnh không hợp lệ',
  'invalid-placement': 'Chế độ đặt không hợp lệ',
  'invalid-rotation-flag': 'Cờ bật xoay không hợp lệ',
  'invalid-shape-kind': 'Loại hình không hợp lệ',
  'invalid-solution': 'Nghiệm mẫu không hợp lệ',
  'invalid-solution-step': 'Một bước nghiệm mẫu không hợp lệ',
  'invalid-victory-verse': 'Câu thắng không hợp lệ',
  'missing-id': 'Thiếu id màn',
  'missing-piece-id': 'Có mảnh thiếu id',
  'missing-solutions': 'Thiếu nghiệm mẫu',
  'missing-title': 'Thiếu tên màn',
  'par-mismatch': 'parMs lệch so với nghiệm mẫu đầu tiên (chạy lại content:author)',
  'rotation-uniform-orientation': 'Màn xoay: mảnh giống nhau phải cùng hướng ở khay',
  'shape-cells-mismatch': 'Ô của mảnh không khớp hình đã khai báo',
  'solution-piece-out-of-bounds': 'Mảnh trong nghiệm mẫu vượt ra ngoài bàn',
  'solution-rotation-disallowed': 'Nghiệm mẫu có xoay nhưng màn không cho xoay',
  'solution-target-mismatch': 'Nghiệm mẫu không ra đúng hình đích',
  'target-cell-out-of-bounds': 'Ô đích nằm ngoài bàn',
  'unknown-anchor': 'Nghiệm mẫu dùng neo không tồn tại',
  'unknown-solution-piece': 'Nghiệm mẫu dùng mảnh không tồn tại',
};

export function issueLabel(code: string): string | undefined {
  const overlap = /^chapter-(\d+)-no-overlap$/.exec(code);
  if (overlap) return `Chương ${overlap[1]} cấm xếp chồng: nghiệm mẫu có mảnh chồng lên nhau`;
  return ISSUE_LABELS[code];
}

/** "<label> (<code>)", or the raw code when no label is known. */
export function describeIssue(code: string): string {
  const label = issueLabel(code);
  return label ? `${label} (${code})` : code;
}
