import type { ManifestEntry } from './document.ts';

export const campaignManifest: readonly ManifestEntry[] = [
  // Chương 1 — Khởi Nguyên (10 màn: 1-1…1-6 cũ, 1-7…1-10 là đuôi khó, chưa có nội dung)
  { id: '1-1', title: 'Sao Trời', chapter: 1, order: 1, contentRevision: 'song-tinh-v3', status: 'approved', dataPath: 'src/content/levels/1-1.json' },
  { id: '1-2', title: 'Tháp Tiên Tri', chapter: 1, order: 2, contentRevision: 'bao-thap-v3', status: 'approved', dataPath: 'src/content/levels/1-2.json' },
  { id: '1-3', title: 'Tinh Điệp', chapter: 1, order: 3, contentRevision: 'canh-chim-v3', status: 'approved', dataPath: 'src/content/levels/1-3.json' },
  { id: '1-4', title: 'Ngọn Hải Đăng', chapter: 1, order: 4, contentRevision: 'hai-dang-v3', status: 'approved', dataPath: 'src/content/levels/1-4.json' },
  { id: '1-5', title: 'Chiếc Thuyền Sao', chapter: 1, order: 5, contentRevision: 'thuyen-sao-v3', status: 'approved', dataPath: 'src/content/levels/1-5.json' },
  { id: '1-6', title: 'Vương Miện Cát Vàng', chapter: 1, order: 6, contentRevision: 'vuong-mien-v2', status: 'approved', dataPath: 'src/content/levels/1-6.json' },
  { id: '1-7', title: 'Chong Chóng Gió', chapter: 1, order: 7, contentRevision: 'chong-chong-v2', status: 'approved', dataPath: 'src/content/levels/1-7.json' },
  { id: '1-8', title: 'Lối Chia Sai', chapter: 1, order: 8, contentRevision: 'loi-chia-sai-v4', status: 'approved', dataPath: 'src/content/levels/1-8.json' },
  { id: '1-9', title: 'Sườn Núi Tinh Tú', chapter: 1, order: 9, contentRevision: 'suon-nui-v4', status: 'approved', dataPath: 'src/content/levels/1-9.json' },
  { id: '1-10', title: 'Bảo Ngọc Lục Giác', chapter: 1, order: 10, contentRevision: 'bao-ngoc-v2', status: 'approved', dataPath: 'src/content/levels/1-10.json' },

  // Chương 2 — Giao Thoa (28 màn: 2-1…2-6, 2-7…2-13 chuyển từ chương 3 cũ, 2-14…2-28 từ studio)
  { id: '2-1', title: 'Mũi Tên Chỉ Thiên', chapter: 2, order: 11, contentRevision: 'mui-ten-v2', status: 'approved', dataPath: 'src/content/levels/2-1.json' },
  { id: '2-2', title: 'Màn mau-2-2-remake', chapter: 2, order: 12, contentRevision: 'canh-buom-v3', status: 'approved', dataPath: 'src/content/levels/2-2.json' },
  { id: '2-3', title: 'Màn mau-2-3-remake', chapter: 2, order: 13, contentRevision: 'trai-tim-v3', status: 'approved', dataPath: 'src/content/levels/2-3.json' },
  { id: '2-4', title: 'Mắt Thần', chapter: 2, order: 14, contentRevision: 'mat-tien-tri-v2', status: 'approved', dataPath: 'src/content/levels/2-4.json' },
  { id: '2-5', title: 'Đồng Hồ Cát', chapter: 2, order: 15, contentRevision: 'dong-ho-cat-v2', status: 'approved', dataPath: 'src/content/levels/2-5.json' },
  { id: '2-6', title: 'Hộ Mệnh', chapter: 2, order: 16, contentRevision: 'dai-an-v2', status: 'approved', dataPath: 'src/content/levels/2-6.json' },
  { id: '2-7', title: 'Nhật Nguyệt Song Huyền', chapter: 2, order: 17, contentRevision: 'nhat-nguyet-v2', status: 'approved', dataPath: 'src/content/levels/2-7.json' },
  { id: '2-8', title: 'Thuyền Buồm Hoàng Hôn', chapter: 2, order: 18, contentRevision: 'thuyen-buom-v2', status: 'approved', dataPath: 'src/content/levels/2-8.json' },
  { id: '2-9', title: 'Mèo Thần', chapter: 2, order: 19, contentRevision: 'meo-than-v2', status: 'approved', dataPath: 'src/content/levels/2-9.json' },
  { id: '2-10', title: 'Hoa Sen', chapter: 2, order: 20, contentRevision: 'hoa-sen-v2', status: 'approved', dataPath: 'src/content/levels/2-10.json' },
  { id: '2-11', title: 'Kim Tự Tháp Nhật Thực', chapter: 2, order: 21, contentRevision: 'kim-tu-thap-v2', status: 'approved', dataPath: 'src/content/levels/2-11.json' },
  { id: '2-12', title: 'Sao Bát Phương', chapter: 2, order: 22, contentRevision: 'sao-bat-phuong-v2', status: 'approved', dataPath: 'src/content/levels/2-12.json' },
  { id: '2-13', title: 'Mandala Thiên Cầu', chapter: 2, order: 23, contentRevision: 'mandala-v2', status: 'approved', dataPath: 'src/content/levels/2-13.json' },
  { id: '2-14', title: 'Màn man-2-7', chapter: 2, order: 24, contentRevision: 'man-man-2-7-v2', status: 'approved', dataPath: 'src/content/levels/2-14.json' },
  { id: '2-15', title: 'Màn man-2-8', chapter: 2, order: 25, contentRevision: 'man-man-2-8-v2', status: 'approved', dataPath: 'src/content/levels/2-15.json' },
  { id: '2-16', title: 'Màn man-2-9', chapter: 2, order: 26, contentRevision: 'man-man-2-9-v2', status: 'approved', dataPath: 'src/content/levels/2-16.json' },
  { id: '2-17', title: 'Màn man-2-10', chapter: 2, order: 27, contentRevision: 'man-man-2-10-v2', status: 'approved', dataPath: 'src/content/levels/2-17.json' },
  { id: '2-18', title: 'Màn man-2-11', chapter: 2, order: 28, contentRevision: 'man-man-2-11-v2', status: 'approved', dataPath: 'src/content/levels/2-18.json' },
  { id: '2-19', title: 'Màn man-2-12', chapter: 2, order: 29, contentRevision: 'man-man-2-12-v2', status: 'approved', dataPath: 'src/content/levels/2-19.json' },
  { id: '2-20', title: 'Màn man-2-13', chapter: 2, order: 30, contentRevision: 'man-man-2-13-v2', status: 'approved', dataPath: 'src/content/levels/2-20.json' },
  { id: '2-21', title: 'Màn man-2-14', chapter: 2, order: 31, contentRevision: 'man-man-2-14-v2', status: 'approved', dataPath: 'src/content/levels/2-21.json' },
  { id: '2-22', title: 'Màn man-2-15', chapter: 2, order: 32, contentRevision: 'man-man-2-15-v2', status: 'approved', dataPath: 'src/content/levels/2-22.json' },
  { id: '2-23', title: 'Màn man-2-16', chapter: 2, order: 33, contentRevision: 'man-man-2-16-v2', status: 'approved', dataPath: 'src/content/levels/2-23.json' },
  { id: '2-24', title: 'Màn man-2-17', chapter: 2, order: 34, contentRevision: 'man-man-2-17-v2', status: 'approved', dataPath: 'src/content/levels/2-24.json' },
  { id: '2-25', title: 'Màn man-2-18', chapter: 2, order: 35, contentRevision: 'man-man-2-18-v2', status: 'approved', dataPath: 'src/content/levels/2-25.json' },
  { id: '2-26', title: 'Màn man-2-19', chapter: 2, order: 36, contentRevision: 'man-man-2-19-v2', status: 'approved', dataPath: 'src/content/levels/2-26.json' },
  { id: '2-27', title: 'Màn man-2-20', chapter: 2, order: 37, contentRevision: 'man-man-2-20-v2', status: 'approved', dataPath: 'src/content/levels/2-27.json' },
  { id: '2-28', title: 'Màn man-2-21', chapter: 2, order: 38, contentRevision: 'man-man-2-21-v3', status: 'approved', dataPath: 'src/content/levels/2-28.json' },

  // Chương 3 — Luân Chuyển (xoay, không XOR): 3-1…3-4 đặt theo neo; 3-5…3-10 đặt tự do (3-8…3-10 có xoay liên động)
  { id: '3-1', title: 'La Bàn Gió', chapter: 3, order: 39, contentRevision: 'la-ban-gio-v2', status: 'approved', dataPath: 'src/content/levels/3-1.json' },
  { id: '3-2', title: 'Lưỡi Kiếm Thiên Thể', chapter: 3, order: 40, contentRevision: 'luoi-kiem-v2', status: 'approved', dataPath: 'src/content/levels/3-2.json' },
  { id: '3-3', title: 'Thuyền Cổ Ngữ', chapter: 3, order: 41, contentRevision: 'thuyen-co-ngu-v2', status: 'approved', dataPath: 'src/content/levels/3-3.json' },
  { id: '3-4', title: 'Bánh Xe Số Phận', chapter: 3, order: 42, contentRevision: 'banh-xe-v2', status: 'approved', dataPath: 'src/content/levels/3-4.json' },
  { id: '3-5', title: 'Mũi Tên Gió', chapter: 3, order: 43, contentRevision: 'mui-ten-gio-v1', status: 'approved', dataPath: 'src/content/levels/3-5.json' },
  { id: '3-6', title: 'Thuyền Buồm Thiên Hà', chapter: 3, order: 44, contentRevision: 'thuyen-buom-thien-ha-v1', status: 'approved', dataPath: 'src/content/levels/3-6.json' },
  { id: '3-7', title: 'Sao Tứ Phương', chapter: 3, order: 45, contentRevision: 'sao-tu-phuong-v1', status: 'approved', dataPath: 'src/content/levels/3-7.json' },
  { id: '3-8', title: 'Cung Tên Liên Hoàn', chapter: 3, order: 46, contentRevision: 'cung-ten-lien-hoan-v1', status: 'approved', dataPath: 'src/content/levels/3-8.json' },
  { id: '3-9', title: 'Tên Lửa Tiên Tri', chapter: 3, order: 47, contentRevision: 'ten-lua-tien-tri-v1', status: 'approved', dataPath: 'src/content/levels/3-9.json' },
  { id: '3-10', title: 'Đại Ấn Luân Chuyển', chapter: 3, order: 48, contentRevision: 'dai-an-luan-chuyen-v1', status: 'approved', dataPath: 'src/content/levels/3-10.json' },
  { id: '3-11', title: 'Sao Chổi Hội Tụ', chapter: 3, order: 49, contentRevision: 'sao-choi-hoi-tu-v2', status: 'approved', dataPath: 'src/content/levels/3-11.json' },
  { id: '3-12', title: 'Thuyền Buồm Ngân Hà', chapter: 3, order: 50, contentRevision: 'thuyen-buom-ngan-ha-v2', status: 'approved', dataPath: 'src/content/levels/3-12.json' },
  { id: '3-13', title: 'Vệ Tinh Đôi Cánh', chapter: 3, order: 51, contentRevision: 've-tinh-doi-canh-v2', status: 'approved', dataPath: 'src/content/levels/3-13.json' },
  { id: '3-14', title: 'Tháp Quan Tinh', chapter: 3, order: 52, contentRevision: 'thap-quan-tinh-v2', status: 'approved', dataPath: 'src/content/levels/3-14.json' },
  { id: '3-15', title: 'Đài Sao Giao Hướng', chapter: 3, order: 53, contentRevision: 'dai-sao-giao-huong-v2', status: 'approved', dataPath: 'src/content/levels/3-15.json' },
  { id: '3-16', title: 'Đồng Hồ Tinh Vân', chapter: 3, order: 54, contentRevision: 'dong-ho-tinh-van-v2', status: 'approved', dataPath: 'src/content/levels/3-16.json' },
  { id: '3-17', title: 'Kính Vọng Thiên Hà', chapter: 3, order: 55, contentRevision: 'kinh-vong-thien-ha-v2', status: 'approved', dataPath: 'src/content/levels/3-17.json' },
  { id: '3-18', title: 'Trạm Đáp Mặt Trăng', chapter: 3, order: 56, contentRevision: 'tram-dap-mat-trang-v2', status: 'approved', dataPath: 'src/content/levels/3-18.json' },
  { id: '3-19', title: 'Mũi Giáo Sao', chapter: 3, order: 57, contentRevision: 'mui-giao-sao-v2', status: 'approved', dataPath: 'src/content/levels/3-19.json' },
  { id: '3-20', title: 'Vương Miện Quỹ Đạo', chapter: 3, order: 58, contentRevision: 'vuong-mien-quy-dao-v2', status: 'approved', dataPath: 'src/content/levels/3-20.json' },

  // Chương 4 — Hội Tụ: khóa, hiện 'Sắp ra mắt' trên bản đồ (không có màn)
];

/** Kiểm tra một id có phải là mã màn thuộc chiến dịch hay không */
export function isCampaignId(id: string): boolean {
  return campaignManifest.some((m) => m.id === id);
}
