/** Khóa localStorage mà SDK gameanalytics 5.0.0 dùng (`GA::<gameKey>::<key>`, xem GAStore trong SDK). */
export const GA_STORE_KEYS: readonly string[] = ['ga_event', 'ga_session', 'ga_progression', 'ga_items'];

/** Xóa sự kiện chưa gửi và trạng thái phiên của SDK khi người chơi rút lại đồng ý. */
export function clearGameAnalyticsStore(store: Pick<Storage, 'removeItem'> | null, gameKey: string): void {
  if (!store) return;
  for (const key of GA_STORE_KEYS) {
    try {
      store.removeItem(`GA::${gameKey}::${key}`);
    } catch {
      // Không xóa được thì thôi; SDK đã ngừng gửi.
    }
  }
}
