/**
 * Mở liên kết ngoài ở cửa sổ riêng (trình duyệt hệ thống trong app Android) và nuốt mọi lỗi.
 * Không điều hướng WebView của game đi đâu cả.
 */
export function openExternal(url: string, win: Pick<Window, 'open'> = window): void {
  try {
    win.open(url, '_blank', 'noopener');
  } catch {
    // Không mở được: người chơi vẫn ở nguyên màn hình hiện tại.
  }
}
