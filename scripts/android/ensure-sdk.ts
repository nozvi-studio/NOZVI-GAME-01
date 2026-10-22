// Makes sure Gradle can find the Android SDK. `android/local.properties` is machine-specific and
// git-ignored, so a fresh clone does not have it. If ANDROID_HOME / ANDROID_SDK_ROOT is set, or the
// file exists, there is nothing to do; otherwise write it from the platform's default SDK location.
import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const localProperties = resolve('android', 'local.properties');

function findSdk(): string | undefined {
  const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : undefined;
  const candidates = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
    join(homedir(), 'Android', 'Sdk'),
  ];
  return candidates.find((p): p is string => Boolean(p) && existsSync(p as string));
}

const envSdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (envSdk) {
  if (!existsSync(envSdk)) {
    console.error(`ANDROID_HOME / ANDROID_SDK_ROOT points to a missing folder: ${envSdk}`);
    process.exit(1);
  }
  process.exit(0);
}
if (existsSync(localProperties)) process.exit(0);

const sdk = findSdk();
if (!sdk) {
  console.error(
    'Android SDK not found. Install it (Android Studio > SDK Manager), then either set the ' +
      'ANDROID_HOME environment variable or run this again after creating android/local.properties ' +
      'with: sdk.dir=<path to your SDK>',
  );
  process.exit(1);
}

// Gradle expects Java-properties escaping: backslashes doubled, colon escaped.
const escaped = sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
writeFileSync(localProperties, `sdk.dir=${escaped}\n`);
console.log(`Wrote android/local.properties (sdk.dir=${sdk})`);
