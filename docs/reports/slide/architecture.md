# Slide 25 · Kiến trúc triển khai thực tế (Nozvi)

Nội dung điền vào placeholder của `image.png`: sơ đồ kiến trúc và 5 ô thông tin bên phải.

## Sơ đồ kiến trúc

```mermaid
flowchart LR
    subgraph GAME["01 · Phaser 3 + TypeScript (Capacitor Android)"]
        PS["PlayScene<br/>vào, kéo, xoay, reset, thắng, rời"]
        GE["Handler lỗi toàn cục<br/>window.onerror · unhandledrejection"]
    end

    subgraph FACADE["02 · Telemetry (Facade / Port)"]
        LT["LevelTracker<br/>đếm trong RAM, mỗi lượt đúng 1 sự kiện kết thúc"]
        AP["AnalyticsPort<br/>hàng đợi 100 sự kiện, gom 2 giây"]
        CP["CrashReporterPort<br/>tối đa 10 báo cáo mỗi 60s, loại trùng, chống lặp"]
    end

    subgraph ADAPTER["03 · Platform adapter (infrastructure)"]
        CD["sentryCrashDriver<br/>import() động, init ở nền, hạn chót 8s"]
        GD["gameAnalyticsDriver<br/>chỉ chạy sau khi Đồng ý, chờ isReady()"]
        CG["Consent gate<br/>chưa Đồng ý thì không tải SDK"]
    end

    subgraph PROVIDER["04 · Provider"]
        SE["Sentry<br/>@sentry/browser"]
        GA["GameAnalytics<br/>gameanalytics 5.0.0"]
    end

    subgraph DASH["05 · Dashboard"]
        SD["Sentry Issues<br/>lọc theo platform, level, release"]
        GD2["GameAnalytics<br/>Progression, Design events"]
    end

    PS --> LT --> AP --> GD
    PS -. "setContext: level, chapter, mode" .-> CP
    GE --> CP --> CD
    CG --> GD
    CD --> SE --> SD
    GD --> GA --> GD2

    NOTE["Không có khóa cấu hình thì không có driver:<br/>mọi lệnh là no-op, game chạy như cũ.<br/>Lỗi SDK bị nuốt, không bao giờ chặn game."]
    ADAPTER --- NOTE

    classDef note fill:#fff8e1,stroke:#c9a227,color:#333;
    class NOTE note;
```

## Thông tin bên phải slide

| Ô trên slide | Nội dung |
| --- | --- |
| Tên game / project | Nozvi (Mirror puzzle) · Phaser 3 + TypeScript + Vite · Capacitor Android · v1.0.0 |
| Error capture layer | `installGlobalErrorHandlers` (`error`, `unhandledrejection`) + `CrashReporterPort.capture` |
| SDK configuration | `VITE_SENTRY_DSN`, `VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY` trong `.env.local` (đọc lúc build). Sentry: `release` = `APP_VERSION`, `environment` = mode build, `sendDefaultPii` = false, tag `platform` / `native` / `level` / `chapter` / `mode` |
| Provider đã chọn | Sentry (crash) + GameAnalytics (tracking). Slide mẫu ghi PostHog nhưng dự án không dùng |
| Reporting workflow | Lỗi JS → Sentry Issues (chưa có source map). Start / complete / abandon → GameAnalytics Progression + Design (Moves, Resets, Abandon) |
