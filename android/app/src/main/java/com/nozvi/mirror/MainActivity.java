package com.nozvi.mirror;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Mirror chạy toàn màn hình. Thanh trạng thái và thanh điều hướng bị ẩn, và
 * WebView được vẽ tràn qua cả notch, nên canvas chiếm trọn tấm nền.
 *
 * Phần an toàn quanh notch do lớp web tự xử lý qua `env(safe-area-inset-*)`;
 * `viewport-fit=cover` trong index.html là thứ bật các biến đó.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Tự quản lý inset; nếu để hệ thống chèn padding thì WebView co lại và
        // dải đen quay về đúng chỗ cũ.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        hideSystemBars();
    }

    /**
     * Android trả thanh hệ thống về mỗi khi cửa sổ lấy lại focus (mở lại app,
     * đóng thông báo). Không đặt lại ở đây thì game chỉ toàn màn hình đúng một
     * lần sau khi khởi động.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), decorView);

        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
