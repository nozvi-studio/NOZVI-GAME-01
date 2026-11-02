# Báo cáo triển khai: Crash reporting (Sentry) và Tracking người chơi (GameAnalytics)

Dự án: Nozvi (Phaser 3 + TypeScript + Vite, đóng gói Android bằng Capacitor).
Ngày: 2026-10-26. Nhánh: `feature/game-analytics` (tách từ `feature/sentry-crash-reporting`).

## 1. Tóm tắt

| Hạng mục | Mục đích | Công cụ | Trạng thái |
| --- | --- | --- | --- |
| Crash reporting | Nhận cảnh báo khi game gặp lỗi JavaScript | Sentry (`@sentry/browser` 11.9.0) | Code xong, có test. **Chưa kiểm chứng với Sentry thật** (cần DSN) |
| Tracking người chơi | Biết người chơi vào, thắng, bỏ màn nào | GameAnalytics (`gameanalytics` 5.0.0) | Code xong, có test. **Đã kiểm chứng trên điện thoại Android 14 và 15 (VN)** cho chế độ campaign |

Cả hai đều là **tùy chọn và mặc định tắt**: không cấu hình khóa thì không có gì được nạp hay gửi, game chạy y như trước. Cả hai chỉ là phần phụ: SDK treo, lỗi mạng hay bị chặn đều không làm hỏng game.

## 2. Kiến trúc chung

Hai tính năng dùng chung một "seam" (điểm cắm) để game không phụ thuộc trực tiếp vào SDK nào:

```
Game (PlayScene, handler lỗi toàn cục)
        │  gọi qua cổng (port)
        ▼
PlatformServices ── CrashReporterPort ──► createCrashReporter ──► CrashDriver ──► Sentry
   (application)  └─ AnalyticsPort ─────► createAnalytics ───────► AnalyticsDriver ──► GameAnalytics
                                          (hàng đợi, giới hạn)      (console khi dev)
```

| File | Vai trò |
| --- | --- |
| `src/application/platformPort.ts` | Định nghĩa `CrashReporterPort`, `AnalyticsPort`, `PlatformServices` |
| `src/infrastructure/platformServices.ts` | `createCrashReporter` (chặn lặp, giới hạn tần suất), `createAnalytics` (hàng đợi), `initInBackground` (khởi tạo SDK ở nền, có hạn chót), `installGlobalErrorHandlers` |
| `src/main.ts` | Chọn driver, tạo `platform`, nối vào game |

Ba nguyên tắc áp dụng chung:
1. **Không ném lỗi, không chặn game.** Mọi lỗi từ driver bị nuốt (`safely`).
2. **Khởi tạo ở nền, có hạn chót.** `initInBackground` không bao giờ reject và không chờ quá 8 giây; SDK treo thì driver đứng yên.
3. **Không có driver thì mọi lệnh là no-op.**

## 3. Crash reporting (Sentry)

Commit: `7dd226a` (seam), `64add66` (Sentry), `54a854a` (tách nguồn lỗi test, đánh dấu lỗi toàn cục là unhandled).

### 3.1 Cách hoạt động
- Bật bằng biến `VITE_SENTRY_DSN` trong `.env.local` (đã nằm trong `.gitignore`, không commit). Không có DSN thì không có driver.
- `src/infrastructure/sentryCrashDriver.ts` nạp `@sentry/browser` bằng `import()` động vào chunk riêng và khởi tạo ở nền. Các lệnh gọi trước khi Sentry tải xong được giữ và chạy lại đúng thứ tự.
- Lỗi toàn cục (`window.onerror`, `unhandledrejection`) đi qua `installGlobalErrorHandlers`: luôn được `console.error` như trước, rồi mới chuyển cho Sentry. Đánh dấu `handled: false` để Sentry gắn nhãn "Unhandled" đúng.
- Tắt `GlobalHandlers` của chính Sentry để một lỗi không bị báo hai lần.
- `sendDefaultPii: false`: không gửi thông tin cá nhân mặc định. Gửi kèm `release` (= `APP_VERSION`) và `environment` (= chế độ build).

### 3.2 Các lớp bảo vệ (`createCrashReporter`)
| Bảo vệ | Giá trị mặc định |
| --- | --- |
| Số báo cáo tối đa mỗi cửa sổ thời gian | 10 mỗi 60 giây |
| Số breadcrumb tối đa mỗi cửa sổ | 100 mỗi 60 giây |
| Bỏ báo cáo trùng trong cùng cửa sổ | Có (khóa theo tên lỗi, message, dòng stack, nguồn) |
| Chặn vòng lặp (SDK tự sinh lỗi → handler → SDK lại sinh lỗi) | Có (cờ `busy` chống gọi lồng nhau) |

### 3.3 Công cụ kiểm tra (chỉ bản dev)
Trong trình duyệt khi chạy `npm run dev`, gọi `window.__crashTest('capture' | 'throw' | 'reject')` để gây lỗi giả: báo thủ công, lỗi chưa bắt, hoặc promise bị từ chối. `src/devtools/crashTest.ts` không có trong bản release.

### 3.4 Test
`tests/sentryCrashDriver.test.ts` (7 test): khởi tạo đúng tham số, thứ tự lệnh khi tải chậm, tải hỏng, treo vĩnh viễn, `init` ném lỗi, đánh dấu unhandled, `__crashTest`. `tests/platformServices.test.ts` (16 test) phủ cả phần dùng chung.

### 3.5 Chưa làm / chưa xác minh
- **Chưa chạy với Sentry thật.** Cần DSN trong `.env.local` rồi dùng `__crashTest` để xác nhận lỗi lên được dashboard.
- **Source map chưa được tải lên**, nên stack trace trên Sentry là mã đã nén.
- Driver hiện là **driver web** chạy trong WebView, nên (suy ra từ thiết kế) chỉ bắt lỗi JavaScript. Lỗi native của Android cần `@sentry/capacitor`, chưa làm.
- Chưa có driver CrazyGames; cần kiểm tra quy định của họ về request ra ngoài.
- Cần cập nhật Privacy Policy và Data Safety (COMP-01).

## 4. Tracking người chơi (GameAnalytics)

Commit: `dbd1e1b` (tracker), `47f7d4c` → `3e443dd` (driver, consent, nối vào game, tài liệu).

### 4.1 Luồng dữ liệu

```
PlayScene ──► LevelTracker ──► AnalyticsPort ──► hàng đợi (gom 2 giây) ──► GameAnalyticsDriver ──► GameAnalytics
 (vào, kéo,    (đếm trong RAM,                                             │ chưa đồng ý? bỏ
  xoay, reset,  mỗi lượt đúng                                              │ chờ SDK sẵn sàng rồi mới gửi
  thắng, rời)   1 sự kiện kết thúc)
```

### 4.2 `LevelTracker` (`src/application/levelTracker.ts`)
Đếm số lần kéo, xoay, reset **trong bộ nhớ** và chỉ phát sự kiện ở ba mốc: vào màn, thắng, bỏ. Không gửi từng thao tác, vì hàng đợi chỉ giữ 100 sự kiện và khi đầy sẽ bỏ cái cũ nhất, mà `level_start` là sự kiện quan trọng nhất.
- Mỗi lượt chơi có **đúng một** sự kiện kết thúc, dù màn hình gọi "rời" nhiều lần.
- Mở lượt mới khi lượt cũ chưa kết thúc thì lượt cũ được đóng là "bỏ".
- Chơi lại sau khi thắng được tính là lượt mới.
- Theo dõi cả `campaign` và `endless` (màn endless dùng mã `endless-<chương>-<số>` vì id trong pool bị lặp). **Không** theo dõi màn chạy bằng harness/Studio của dev.
- Khi tắt app, `main.ts` báo `app-exit` ở sự kiện `pagehide`.

### 4.3 Sự kiện gửi lên GameAnalytics
| Sự kiện nội bộ | Gửi lên GameAnalytics |
| --- | --- |
| `level_start` | Progression `Start`: `chapter<N>` / mã màn |
| `level_complete` | Progression `Complete` (điểm = số sao) + design `Complete:Moves:<màn>` (số lần kéo) + `Complete:Resets:<màn>` (số lần reset) |
| `level_abandon` | Progression `Fail` + design `Abandon:<màn>` (giá trị = số lần reset) |

Một lượt chơi thắng sinh 4 sự kiện (Start, Complete, Moves, Resets); một lượt bỏ sinh 3 (Start, Fail, Abandon). SDK còn tự gửi sự kiện `user` (mở phiên) và `session_end`; đó là nguồn của số liệu Active User.

**Chưa gửi lên GameAnalytics:** lý do bỏ màn (`reason`), thời gian chơi trước khi bỏ, số lần kéo của lượt bỏ, và chế độ chơi (phân biệt endless chỉ qua tiền tố `endless-` của mã màn). Các thông tin này có trong sự kiện nội bộ.

### 4.4 Điều kiện bật và đồng ý của người chơi
- GameAnalytics chỉ bật **trong app Android** (`Capacitor.isNativePlatform()`) và khi có **cả hai** biến `VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY` trong `.env.local`. Khóa được đọc **lúc build** và nằm trong gói JavaScript của app. Thiếu khóa thì SDK không bao giờ được tải; bản dev web in sự kiện ra console.
- Khi bật, lần mở app đầu tiên hiện **màn đồng ý (consent)**: game không vào được cho tới khi người chơi bấm "Đồng ý"; lựa chọn được lưu (`nozvi.analytics.consent.v1`). Đây là **bản tạm** (một câu hỏi, một nút, tiếng Việt, không có nút Từ chối); giao diện và lời văn thật sẽ làm sau.
- SDK **chỉ được tải sau khi đồng ý**. Chưa đồng ý thì sự kiện bị bỏ, không giữ lại.

### 4.5 Xử lý đặc thù của SDK
SDK GameAnalytics **bỏ hẳn** (không xếp hàng) sự kiện gửi trước khi phiên của nó bắt đầu, mà phiên chỉ mở sau khi máy chủ trả lời. Lần chạy thử đầu tiên cho thấy `Start` của màn đầu mỗi lần mở app bị mất. Đã sửa bằng hai việc:
1. `warmUp()`: khởi tạo SDK ngay sau khi đồng ý, không chờ sự kiện đầu tiên.
2. Driver hỏi `isReady()` mỗi 200 ms (tối đa 10 giây) rồi mới gửi; quá hạn thì bỏ.

Lưu ý bảo trì: `isReady()` gọi hàm `isSdkReady` của SDK, hàm này được khai báo `private` trong kiểu dữ liệu nhưng có thật lúc chạy. Gói đang ghim ở `5.0.0`; cần kiểm tra lại dòng này khi nâng phiên bản.

### 4.6 Test
| File | Số test |
| --- | --- |
| `tests/levelTracker.test.ts` | 12 |
| `tests/gameAnalyticsDriver.test.ts` | 13 |
| `tests/analyticsSetup.test.ts` | 5 |
| `tests/analyticsConsent.test.ts` | 4 |
| `tests/consentGate.test.ts` | 1 (chỉ nhánh "đã đồng ý"; phần lớp phủ DOM kiểm bằng tay) |
| `tests/consoleAnalyticsDriver.test.ts` | 2 |

Lần chạy toàn bộ gần nhất: 174 file, 2049 test đều pass; `npm run typecheck` sạch.

### 4.7 Kết quả thử trên máy thật (2026-10-26)
Thử trên Android 14 và 15, quốc gia VN, chế độ campaign:
- Một lượt thắng ra đủ 4 sự kiện (ví dụ màn 1-6: Start, Complete 3 sao, Moves 3, Resets 0).
- `Start` của màn đầu tiên sau khi mở app đã xuất hiện (lỗi mất `Start` đã hết).
- Thoát giữa chừng ra đủ `Fail:chapter2:2-18` và `Abandon:2-18`.
- `session_end` của phiên trước đến muộn (gửi khi mở app lần sau), nên số liệu độ dài phiên bị trễ. Đây là hành vi bình thường của SDK.
- **Chưa thử:** chế độ endless.

## 5. Dữ liệu thu thập và tuân thủ

Dữ liệu quan sát được trong các sự kiện thật: mã người dùng ẩn danh do SDK tự sinh (GUID), mã phiên, phiên bản hệ điều hành, nền tảng, quốc gia, phiên bản build, loại kết nối. `device`, `manufacturer` trả về `unknown` và `browser_version` ghi `chrome 4` vì WebView không cung cấp, nên không dùng được để chia theo thiết bị. Sự kiện của game chỉ gồm mã màn, chương, điểm sao và các số đếm. Không có tên, email hay vị trí chính xác.

Tài liệu SDK không liệt kê đầy đủ dữ liệu nó tự gửi, nên khi điền form Data Safety cần đối chiếu thêm.

**Việc chưa xong ở phía tuân thủ:** chưa có link Privacy Policy / Terms (blocker COMP-01 trong `docs/testing/release-checklist-compliance.md`); cần cập nhật Data Safety và làm màn consent bản thật. Theo chủ dự án, ở Việt Nam việc phân tích dữ liệu người dùng bắt buộc có sự đồng ý (chưa đối chiếu với văn bản pháp luật cụ thể); cần người phụ trách compliance xác nhận việc cổng "bắt buộc Đồng ý, không có Từ chối" có được chấp nhận cho bản phát hành và Google Play hay không.

## 6. Cách bật và kiểm tra

| Việc | Cách làm |
| --- | --- |
| Bật Sentry | Đặt `VITE_SENTRY_DSN` trong `.env.local`, chạy `npm run dev`, gọi `window.__crashTest('throw')` trong console trình duyệt, kiểm tra issue trên Sentry |
| Xem sự kiện tracking khi dev | `npm run dev`: sự kiện in ra console với tiền tố `[analytics]` (chậm khoảng 2 giây do gom lô) |
| Bật GameAnalytics trên Android | Đặt cả hai khóa vào `.env.local` **trước khi** build, rồi `npm run android:build` và cài APK |
| Xem log SDK trên điện thoại | Cắm USB, bật USB debugging, mở `chrome://inspect/#devices` trên máy tính |
| Xem dữ liệu | Dashboard GameAnalytics: dashboard Progression có sẵn cho tỷ lệ thắng, bỏ theo màn; design event (Moves, Resets, Abandon) cần tự tạo widget |

## 7. Việc còn lại

1. Kiểm chứng Sentry với DSN thật; tải source map; cân nhắc `@sentry/capacitor` cho lỗi native.
2. Thử endless trên máy thật.
3. Màn consent bản thật (giao diện, lời văn, dịch 10 ngôn ngữ), cân nhắc nút Từ chối và công tắc trong Settings.
4. Privacy Policy, Data Safety, và xác nhận pháp lý về cổng đồng ý bắt buộc.
5. Tùy chọn: gửi thêm lý do bỏ màn và thời gian chơi lên GameAnalytics; bỏ qua nếu game đơn giản không cần.
6. Driver GameAnalytics cho nền tảng web nếu phát hành web (cần khóa riêng).

## 8. Tài liệu liên quan
- Thiết kế: `docs/superpowers/specs/2026-10-26-gameanalytics-driver-design.md`
- Kế hoạch cài đặt: `docs/superpowers/plans/2026-10-26-gameanalytics-driver.md`
- Checklist: `docs/testing/release-checklist-monetization.md` (MON-06), `docs/testing/release-checklist-compliance.md` (COMP-01)
- Trạng thái và lịch sử: `STATUS.md`, `CHANGELOG.md`
