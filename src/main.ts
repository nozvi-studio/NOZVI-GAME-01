import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { createAdMobDriver, resolveAdMobConfig } from './engine/core/platform/admobDriver.ts';
import { ADS_REGISTRY_KEY } from './presentation/adsServices.ts';
import { BackgroundScene } from './presentation/scenes/BackgroundScene.ts';
import { LoadingScene } from './presentation/scenes/LoadingScene.ts';
import { MenuScene } from './presentation/scenes/MenuScene.ts';
import { PlayScene } from './presentation/scenes/PlayScene.ts';
import { LevelSelectScene } from './presentation/scenes/LevelSelectScene.ts';
import { FixtureScene } from './presentation/scenes/FixtureScene.ts';
import { setupAndroidLifecycle } from './engine/core/platform/lifecycle.ts';
import { createPlatformServices, installGlobalErrorHandlers } from './engine/core/platform/platformServices.ts';
import { createProgressRepository } from './infrastructure/progressRepository.ts';
import { getSafeStorage, memoryStorage } from './engine/core/platform/safeStorage.ts';
import { campaignManifest } from './content/manifest.ts';
import { director, PhaserSceneHost } from './presentation/transitions/SceneDirector.ts';
import { setMotionScale } from './presentation/transitions/motion.ts';
import { resolveLaunch } from './launchParams.ts';
import { readViewport } from './engine/core/viewport/viewport.ts';
import { setPcBackground } from './presentation/sky/pcBackground.ts';
import { musicUrls } from './infrastructure/audioManifest.ts';
import { browserMusicEnv, browserSfxEnv } from './infrastructure/browserAudioEnv.ts';
import { createMusic } from './infrastructure/music.ts';
import { createSfx } from './infrastructure/sfx.ts';
import { synthSfxDriver } from './infrastructure/synthSfxDriver.ts';
import { renderAll } from './engine/core/audio-synth/webaudio.ts';
import { SFX_PATCHES } from './content/audio/index.ts';
import { AUDIO_REGISTRY_KEY } from './presentation/audio/audioServices.ts';
import type { AudioServices } from './presentation/audio/audioServices.ts';
import { AUDIO_TOKENS } from './presentation/designTokens.ts';
import './style.css';

// Quảng cáo chỉ có trên app native (AdMob). Web và test: no-op. Crash/analytics chưa gắn SDK:
// gắn Sentry/CrazyGames bằng cách truyền driver vào đây.
const adMobConfig = Capacitor.isNativePlatform() ? resolveAdMobConfig(import.meta.env) : null;
if (Capacitor.isNativePlatform() && !adMobConfig) {
  console.warn('[ads] VITE_ADMOB_USE_TEST_ADS=false nhưng thiếu VITE_ADMOB_BANNER_ID / VITE_ADMOB_REWARDED_ID: tắt quảng cáo');
}
const platform = createPlatformServices({
  ads: adMobConfig ? createAdMobDriver(AdMob, adMobConfig) : null,
});
installGlobalErrorHandlers(window, platform.crash);

const launch = resolveLaunch(window.location.search, import.meta.env.DEV);

const viewport = readViewport();

const progressRepo = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2');
const savedSettings = progressRepo.read().progress.settings;
setMotionScale(savedSettings.reducedMotion ? 0 : 1);

// Music lives outside every scene so it plays on through transitions (spec G §2.3)
const music = createMusic(browserMusicEnv(), {
  volume: AUDIO_TOKENS.musicVolume,
  toggleOutMs: AUDIO_TOKENS.toggleOutMs,
  toggleInMs: AUDIO_TOKENS.toggleInMs,
  duckDownMs: AUDIO_TOKENS.duck.downMs,
  duckUpMs: AUDIO_TOKENS.duck.upMs,
  files: musicUrls,
  trackLevel: (id) => (AUDIO_TOKENS.trackLevel as Readonly<Record<string, number | undefined>>)[id] ?? 1,
});
music.setEnabled(savedSettings.music);


/**
 * Các mặt chữ phải có mặt trước khi scene đầu tiên dựng chữ.
 *
 * Mỗi mục là một đặc tả font theo cú pháp CSS shorthand.
 */
const REQUIRED_FACES = [
  "500 16px 'Unbounded'",
  "800 16px 'Unbounded'",
  "400 16px 'Be Vietnam Pro'",
  "500 16px 'Be Vietnam Pro'",
  "600 16px 'Be Vietnam Pro'",
  "700 16px 'Be Vietnam Pro'",
  "600 16px 'Cormorant Garamond'",
  "700 16px 'Cormorant Garamond'",
  // Vài tiêu đề đặt fontStyle: 'bold'. Không nhúng weight 700 thì trình duyệt
  // tự làm đậm giả, nét bệt và rìa bẩn.
  "600 16px 'Baloo 2'",
  "700 16px 'Baloo 2'",
] as const;

/**
 * Mẫu chữ buộc trình duyệt tải cả subset `vietnamese` và `latin-ext`.
 *
 * `@font-face` được tách theo `unicode-range`, còn `document.fonts.load(face)` mặc
 * định chỉ thử với một dấu cách nên chỉ subset latin về kịp; chữ có dấu tiếng Việt
 * khi đó bị Phaser đo và vẽ bằng font dự phòng cho tới khi scene dựng lại.
 */
const FONT_PROBE_TEXT = 'AaĂăÂâĐđÊêÔôƠơƯưẠạẢảẤấẦầẨẩẬậẮắẰằẶặẸẹẾếỀềỆệỈỊịỌọỐốỒồỘộỚớỜờỢợỤụỨứỪừỰựỲỳỸỹ Łł';

/**
 * Chờ webfont trước khi dựng game.
 *
 * Hai lý do phải tự nạp thay vì chỉ chờ `document.fonts.ready`:
 *
 *  - Phaser vẽ chữ bằng canvas 2D. Đặt `ctx.font` KHÔNG kích hoạt trình duyệt
 *    tải webfont, nên nếu không có phần tử DOM nào dùng tới các mặt chữ này thì
 *    `fonts.ready` resolve ngay trong khi font chưa hề được tải.
 *  - Phaser.Text đo bề rộng đúng một lần lúc tạo và không canh lại khi font về
 *    sau, nên dựng sớm là chữ sai font và lệch vị trí vĩnh viễn.
 *
 * Có giới hạn thời gian vì một mặt chữ hỏng không được phép chặn cả game.
 */
async function waitForFonts(timeoutMs = 3000): Promise<void> {
  if (!document.fonts) return;

  const loaded = Promise.all(
    REQUIRED_FACES.map((face) =>
      document.fonts.load(face, FONT_PROBE_TEXT).catch((error) => {
        console.warn('[FONT] không nạp được', face, error);
      })
    )
  ).then(() => document.fonts.ready);

  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

export interface StartGameOptions {
  skipLoading?: boolean;
  onLoadingFrame?: () => void | Promise<void>;
}

export async function startGame(options: StartGameOptions = {}): Promise<void> {
  // Splash and first paint use chapter I; Menu, Map and Play switch it afterwards.
  setPcBackground(1);
  await waitForFonts();

  // BackgroundScene đứng đầu nên tự khởi động và luôn vẽ dưới cùng; các scene
  // khác chỉ chạy khi SceneDirector gọi.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    disableContextMenu: true,
    // Bộ đệm vẽ bằng đúng số pixel vật lý của máy. Hệ toạ độ thiết kế 720x1280
    // được từng scene dựng lại bằng camera zoom (`applyDesignViewport`).
    width: viewport.bufferWidth,
    height: viewport.bufferHeight,
    backgroundColor: '#1A2470',
    scale: {
      // NONE: không để Phaser tự co canvas. CSS lo phần hiển thị, còn kích thước
      // bộ đệm do ta quyết định — đó là điều kiện để hình không bị nội suy.
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [BackgroundScene, LoadingScene, MenuScene, PlayScene, LevelSelectScene, FixtureScene],
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __GAME__?: Phaser.Game }).__GAME__ = game;
  }

  game.registry.set(ADS_REGISTRY_KEY, platform.ads);
  // Consent (UMP) rồi mới khởi tạo SDK; không chặn việc dựng game.
  void platform.ads.init();

  director.setHost(new PhaserSceneHost(game));
  director.setMusic(music);

  game.events.once('ready', () => {
    const webAudio = (game.sound as Phaser.Sound.WebAudioSoundManager).context as
      | AudioContext
      | undefined;

    let sfx = createSfx(null, browserSfxEnv(), {
      volume: AUDIO_TOKENS.sfxVolume,
      maxVoices: AUDIO_TOKENS.maxVoices,
      repeatGapMs: AUDIO_TOKENS.repeatGapMs,
    });

    const settings = progressRepo.read().progress.settings;
    music.setEnabled(settings.music);
    sfx.setEnabled(settings.sfx);

    const prepareAudio = async (): Promise<void> => {
      if (webAudio) {
        try {
          const started = performance.now();
          const buffers = renderAll(SFX_PATCHES, webAudio);
          const elapsed = performance.now() - started;
          if (import.meta.env.DEV) {
            console.info(
              `[audio] rendered ${Object.keys(buffers).length} effects in ${elapsed.toFixed(1)} ms`
            );
          }
          sfx = createSfx(synthSfxDriver(webAudio, buffers), browserSfxEnv(), {
            volume: AUDIO_TOKENS.sfxVolume,
            maxVoices: AUDIO_TOKENS.maxVoices,
            repeatGapMs: AUDIO_TOKENS.repeatGapMs,
          });
          sfx.setEnabled(settings.sfx);
        } catch (err) {
          console.warn('[audio] effect rendering failed, continuing without effects', err);
        }
      }
      const audio: AudioServices = { music, sfx };
      game.registry.set(AUDIO_REGISTRY_KEY, audio);
    };

    if (launch.scene !== 'MenuScene') {
      void prepareAudio();
      options.onLoadingFrame?.();
      if (launch.scene === 'PlayScene') {
        director.boot('PlayScene', launch);
      } else if (launch.scene === 'LevelSelectScene') {
        director.boot('LevelSelectScene', {
          ...(launch.focusLevelId ? { focusLevelId: launch.focusLevelId } : {}),
          ...(launch.revealAll ? { revealAll: true } : {}),
        });
      }
    } else if (launch.skipSplash || options.skipLoading) {
      void prepareAudio();
      options.onLoadingFrame?.();
      director.boot('MenuScene', launch.chapter ? { chapter: launch.chapter } : {});
    } else {
      const sceneManager = game.scene;
      sceneManager.start('LoadingScene', {
        onFirstFrame: options.onLoadingFrame,
        prepareAudio,
      });
    }
  });

  setupAndroidLifecycle({
    onHardwareBack: () => {
      if (director.isTransitioning()) {
        director.skip();
        return;
      }
      const activePlayScene = game.scene.getScene('PlayScene') as PlayScene;
      const activeLevelSelect = game.scene.getScene('LevelSelectScene') as LevelSelectScene;

      if (activePlayScene && activePlayScene.scene.isActive()) {
        activePlayScene.onHardwareBack();
      } else if (activeLevelSelect && activeLevelSelect.scene.isActive()) {
        activeLevelSelect.goToMenu();
      } else {
        App.exitApp();
      }
    },
    onBackground: () => {
      director.skip();
      music.pause();
      game.sound?.pauseAll();
      game.loop.sleep();
    },
    onResume: () => {
      game.loop.wake();
      game.sound?.resumeAll();
      music.resume();
    },
  });
}
