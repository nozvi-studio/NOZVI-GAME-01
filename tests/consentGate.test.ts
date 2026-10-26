import { describe, expect, test } from 'vitest';
import { requestAnalyticsConsent } from '../src/presentation/consent/consentGate.ts';

describe('requestAnalyticsConsent', () => {
  test('đã đồng ý trước đó thì resolve ngay và không chạm DOM', async () => {
    let granted = 0;
    await expect(
      requestAnalyticsConsent({
        isGranted: () => true,
        grant: () => void (granted += 1),
        doc: undefined,
      })
    ).resolves.toBeUndefined();
    expect(granted).toBe(0);
  });
});
