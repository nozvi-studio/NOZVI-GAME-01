# Hỗ trợ màn hình — Nozvi (game màn hình dọc)

> Cập nhật: 2026-11-06 · Nhánh: `fix/ios-viewport-overlap`
> Code: `src/engine/core/viewport/viewport.ts`, `src/engine/core/viewport/designViewport.ts`, `src/presentation/board/layout.ts`, `src/style.css` (`#game`)
> Test: `tests/engine/core/viewport.test.ts`, `tests/engine/core/viewportMatrix.test.ts`

## 1. Nguyên tắc

- **Chỉ màn hình dọc, không xoay.** Game không đổi bố cục khi xoay máy. Android khoá dọc trong `android/app/src/main/AndroidManifest.xml` (`android:screenOrientation="portrait"`). Trên web (trình duyệt, iframe) không khoá được hướng; khi cửa sổ nằm ngang, game hiện khung dọc ở giữa (xem mục 3.4).
- **Kích thước thiết kế gốc: 720 × 1280 (9:16).** Mọi scene vẽ trong hệ toạ độ này. Bề ngang luôn là 720 đơn vị; chỉ chiều cao thay đổi theo máy.
- **Bố cục luôn có trọn 1280 đơn vị chiều cao** nằm giữa lề an toàn trên và dưới (tai thỏ, Dynamic Island, thanh trạng thái, thanh Home, thanh cử chỉ). Đây là điều kiện để header, bảng kính, khay và thanh đáy không chồng lên nhau.
- **Độ nét:** bộ đệm vẽ bằng số pixel vật lý thật (dpr kẹp tối đa 3), camera zoom đưa về hệ 720 đơn vị.

## 2. Các nhóm tỉ lệ màn hình cần hỗ trợ

Tỉ lệ ghi theo chiều dọc (cao : rộng). "Chiều cao thiết kế" là chiều cao hệ toạ độ khi bề ngang = 720.

| Nhóm | Tỉ lệ (cao/rộng) | Máy tiêu biểu | Chiều cao thiết kế | Game xử lý thế nào |
| --- | --- | --- | --- | --- |
| Chuẩn | 16:9 (~1.78) | iPhone 6/7/8/SE, Android cũ, cửa sổ giả lập web/PC | 1280 | Kích thước cơ sở, vừa khít |
| Dài, hẹp | 19.5:9 – 20:9 (~2.16 – 2.22), tới 21:9 (~2.33) | iPhone X trở lên, Galaxy, Xiaomi, Xperia | ~1560 – 1680 | Kéo dài hệ toạ độ; phần dôi ra thành khoảng thở quanh bảng |
| Ngắn, rộng | 4:3 (1.33), 3:2 (1.5), 16:10 (1.6) | iPad, tablet Android, Galaxy Fold khi mở | 1280 (khung 9:16) | Khung dọc 9:16 nằm giữa, hai bên là nền |

### 2.1. Tỉ lệ chuẩn 9:16
- Là tỉ lệ an toàn nhất, dùng làm kích thước cơ sở (720 × 1280; xuất asset theo 1080 × 1920 nếu cần độ nét cao).
- Bảng kính 640 × 800, khay 640 × 136, thanh đáy 116 nằm khít như artboard gốc (`LAYOUT_TOKENS` trong `src/presentation/designTokens.ts`).

### 2.2. Tỉ lệ dài, hẹp (19.5:9 – 21:9)
- Đây là nhóm đông nhất trên điện thoại hiện đại.
- Game **không** letterbox (viền đen trên/dưới): chiều cao thiết kế tăng theo máy (`computeDesignHeight`), nền kéo dài hết màn hình (background bleed).
- Bố cục dọc (`computeLayout`): header bám mép trên, thanh đáy bám mép dưới (đều lùi vào theo lề an toàn), khay nằm trên thanh đáy, bảng căn giữa khoảng còn lại. Phần dôi ra được dùng để nâng cụm đáy (tối đa 48 đơn vị) và phóng to huy hiệu mục tiêu (tối đa ×1.55).
- Nhóm này hầu như luôn có tai thỏ/Dynamic Island và thanh Home, nên lề an toàn là bắt buộc. Xem mục 4.

### 2.3. Tỉ lệ ngắn, rộng (tablet, máy gập)
- Nếu chỉ kéo game ra theo bề ngang thì hệ toạ độ sẽ thấp hơn 1280, các thành phần bị ép và HUD có thể bị cắt hoặc chồng lên nhau.
- Cách game làm: **giới hạn bề ngang canvas theo 9:16**, tính trên phần chiều cao **đã trừ lề an toàn** (`computeViewport`; `max-width` của `#game` trong `style.css` dùng cùng công thức). Canvas nằm giữa, hai bên là nền trang.
- Lỗi đã gặp (2026-11-06, iPad dọc): khung 9:16 trước đây tính trên toàn bộ chiều cao, chưa trừ thanh trạng thái và thanh Home, nên thiếu ~50 đơn vị và đáy bảng kính đè lên đỉnh khay. Đã sửa trên nhánh này.

## 3. Trường hợp đặc biệt

### 3.1. Safari trên iPhone/iPad
- Thanh công cụ của Safari làm vùng nhìn thấy ngắn lại (iPhone 14: 844 → ~664 px CSS), có thể khiến màn hình dài thành gần 9:16 mà vẫn có lề tai thỏ và thanh Home. Đây là trường hợp lỗi chồng bảng/khay đầu tiên được báo trên iPhone.
- `#game` dùng `100dvh` để khớp với `window.innerHeight`.

### 3.2. Android có dpr lớn hơn 3
- Nhiều máy flagship báo `devicePixelRatio` 3.5–4. Bộ đệm kẹp dpr về 3 (`MAX_DPR`); lề an toàn phải quy đổi theo bề ngang canvas thật (`canvasSafeArea`), không chia cho dpr gốc. Nếu chia cho dpr gốc, lề bị tính to hơn 17–33% và bố cục bị ép thiếu cao (đã sửa 2026-11-06).

### 3.3. iPad Split View / Slide Over, Galaxy Fold gập
- Cửa sổ rất hẹp và cao (ví dụ 320 × 1106) thuộc nhóm "dài, hẹp", được xử lý như mục 2.2.

### 3.4. Cửa sổ nằm ngang (web, desktop, iframe)
- Game không xoay. Khung 9:16 nằm giữa theo chiều cao cửa sổ.
- Lề tai thỏ ở hai cạnh (điện thoại xoay ngang trên web) chỉ tính phần thật sự lấn vào canvas; thường bằng 0 vì canvas nằm giữa.

## 4. Lề an toàn (safe area)

- `index.html` cần `viewport-fit=cover`, nếu không trình duyệt luôn báo lề bằng 0.
- Lề đọc bằng phần tử dò `env(safe-area-inset-*)` (`readSafeAreaCssPx`), quy sang đơn vị thiết kế bằng `canvasSafeArea`, dùng trong mọi scene qua `designSafeArea(scene)`.
- Quy tắc khi làm UI mới:
  - Không đặt nút, chữ hay vùng chạm trong lề an toàn trên/dưới.
  - Nền và hiệu ứng trang trí được phép tràn vào lề và ra hết màn hình.
  - Vị trí theo chiều dọc phải tính từ `safe.top` / `designHeight - safe.bottom`, không dùng hằng số 1280.

## 5. Ma trận kiểm thử

`tests/engine/core/viewportMatrix.test.ts` chạy toàn bộ chuỗi viewport → lề an toàn → bố cục màn chơi cho 22 cấu hình:

- **iPhone:** SE (Safari, app), 14 (Safari có thanh công cụ, toàn màn), 15 Pro Max (Safari, toàn màn), 14 xoay ngang.
- **iPad:** mini dọc, Air dọc (Safari), Pro 12.9 dọc, ngang, Split View 1/3.
- **Android:** 9:16 cũ, 20:9, 21:9 (dpr 4), dpr 3.5, Fold gập, Fold mở, tablet dọc.
- **Desktop / web:** 1080p, scale 125%, iframe ngang thấp (800 × 450).

Bất biến được kiểm tra trên mỗi máy:
1. Canvas không rộng hơn cửa sổ; luôn có ≥ 1280 đơn vị giữa hai lề an toàn.
2. Thứ tự dọc header → bảng → khay → thanh đáy, không chồng nhau, không lọt vào lề.
3. Huy hiệu mục tiêu không đè lên thanh sao.
4. Lề trái/phải không cắt vào bảng.

Khi thêm máy mới cần hỗ trợ: thêm một dòng vào mảng `DEVICES` (kích thước `innerWidth × innerHeight` CSS, dpr, lề `env(safe-area-inset-*)`).

## 6. Giới hạn hiện tại và việc còn mở

- **Kích thước đọc một lần lúc khởi động.** Không xử lý resize: thanh Safari đổi giữa ván, bật/tắt Split View, mở/gập Fold khi đang chơi có thể làm canvas bị kéo giãn. Cần tải lại trang/app.
- **Tablet và desktop hiện hai dải nền trống hai bên** (khung 9:16). Bố cục đúng nhưng chưa tận dụng bề ngang. Nếu muốn khác (nền tràn ra hai bên, bố cục riêng cho tablet) thì cần quyết định thiết kế riêng.
- Chưa kiểm tra trên máy thật sau bản sửa 2026-11-06: iPad, iPhone (Safari), một máy Android dpr > 3.
- Chưa có project iOS native trong repo; khi thêm (Capacitor iOS) cần khoá dọc trong `Info.plist` (`UISupportedInterfaceOrientations` = Portrait).
