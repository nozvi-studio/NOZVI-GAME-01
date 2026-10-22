import { describe, expect, it } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { computeLayout, pieceHitbox } from '../src/presentation/board/layout.ts';
import { FEEDBACK_TOKENS } from '../src/presentation/designTokens.ts';
import {
  GESTURE_LOOP_MS,
  GESTURE_TAP_GAP_MS,
  ghostPose,
  gesturePose,
  rotateButtonSpot,
  snapFlash,
  tutorialSpot,
} from '../src/presentation/tutorial/tutorialGeometry.ts';

describe('tutorialSpot', () => {
  const level = loadLevel('1-1', 'campaign');
  const layout = computeLayout(720, 1280);

  it('puts the target at the centre of the sample-solution frame', () => {
    expect(tutorialSpot(level, 'D1', layout)!.target).toEqual({ x: 240, y: 600 });
    expect(tutorialSpot(level, 'D2', layout)!.target).toEqual({ x: 40 + 5 * (64 + 24), y: 200 + 5 * (56 + 24) });
  });

  it('uses half the frame as the target radius', () => {
    expect(tutorialSpot(level, 'D1', layout)!.targetRadius).toBe(120);
  });

  it('puts the tray centre where the real tray piece is hit-tested', () => {
    const spot = tutorialSpot(level, 'D2', layout)!;
    const hit = pieceHitbox(level.pieces[1], { kind: 'tray', turns: 0 }, layout, 1, level.pieces.length);
    expect(spot.trayCentre).toEqual({ x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 });
  });

  it('returns the matching tray well', () => {
    const wells = tutorialSpot(level, 'D1', layout)!.trayWell;
    expect(wells.width).toBeGreaterThan(0);
    expect(wells.y).toBeGreaterThan(layout.boardBounds.y + layout.boardBounds.height);
  });

  it('returns null for an unknown piece', () => {
    expect(tutorialSpot(level, 'nope', layout)).toBeNull();
  });
});

describe('ghostPose', () => {
  it('is hidden at the start of the loop and parked at the tray', () => {
    expect(ghostPose(0)).toEqual({ travel: 0, alpha: 0, scale: 1 });
  });

  it('is fully visible and pressed while it waits at the tray', () => {
    const pose = ghostPose(0.16);
    expect(pose.alpha).toBe(1);
    expect(pose.travel).toBe(0);
    expect(pose.scale).toBeCloseTo(0.92, 5);
  });

  it('travels monotonically from tray to target between 24% and 70%', () => {
    let last = -1;
    for (let p = 0.24; p <= 0.7001; p += 0.02) {
      const { travel } = ghostPose(p);
      expect(travel).toBeGreaterThanOrEqual(last);
      last = travel;
    }
    expect(ghostPose(0.24).travel).toBe(0);
    expect(ghostPose(0.7).travel).toBeCloseTo(1, 5);
  });

  it('fades out after landing and wraps around', () => {
    expect(ghostPose(0.92).alpha).toBeCloseTo(0, 5);
    expect(ghostPose(1.5)).toEqual(ghostPose(0.5));
  });
});

describe('snapFlash', () => {
  it('flashes between 74% and 92% of the loop', () => {
    expect(snapFlash(0.5)).toBe(0);
    expect(snapFlash(0.8)).toBeCloseTo(1, 5);
    expect(snapFlash(0.95)).toBe(0);
  });
});

describe('tutorialSpot, level 3-1', () => {
  const level = loadLevel('3-1', 'campaign');
  const layout = computeLayout(720, 1280);

  it('knows the target pose, including the turns', () => {
    const roof = tutorialSpot(level, 'T1', layout)!;
    expect(roof.target).toEqual({ x: 360, y: 480 });
    expect(roof.targetTurns).toBe(1);
    const square = tutorialSpot(level, 'S1', layout)!;
    expect(square.target).toEqual({ x: 360, y: 640 });
    expect(square.targetTurns).toBe(0);
  });

  it('keeps targetTurns 0 for the 1-1 pieces', () => {
    expect(tutorialSpot(loadLevel('1-1', 'campaign'), 'D1', layout)!.targetTurns).toBe(0);
  });
});

describe('rotateButtonSpot', () => {
  it('centres on the button and uses half its larger side as the radius', () => {
    expect(rotateButtonSpot({ x: 580, y: 1152, width: 112, height: 112 })).toEqual({
      centre: { x: 636, y: 1208 },
      radius: 56,
    });
  });
});

describe('gesturePose, double tap', () => {
  it('taps twice quicker than the game accepts as a double tap', () => {
    expect(GESTURE_TAP_GAP_MS).toBeLessThan(FEEDBACK_TOKENS.doubleTap.windowMs);
  });

  it('presses on each tap and releases in between', () => {
    expect(gesturePose('double-tap', 0).press).toBe(0);
    expect(gesturePose('double-tap', 250).press).toBeCloseTo(1, 5);
    expect(gesturePose('double-tap', 350).press).toBe(0);
    expect(gesturePose('double-tap', 470).press).toBeCloseTo(1, 5);
  });

  it('turns the demo piece once after the second tap and never holds', () => {
    expect(gesturePose('double-tap', 300).turns).toBe(0);
    expect(gesturePose('double-tap', 600).turns).toBe(1);
    expect(gesturePose('double-tap', 600).held).toBe(false);
  });

  it('shows a ripple right after each tap', () => {
    expect(gesturePose('double-tap', 210).ripples[0]).toBeGreaterThan(0.9);
    expect(gesturePose('double-tap', 430).ripples[1]).toBeGreaterThan(0.9);
    expect(gesturePose('double-tap', 1500).ripples).toEqual([0, 0]);
  });

  it('loops', () => {
    expect(gesturePose('double-tap', GESTURE_LOOP_MS['double-tap'] + 250)).toEqual(gesturePose('double-tap', 250));
  });
});

describe('gesturePose, double tap and hold', () => {
  const kind = 'double-tap-hold' as const;
  const { delayMs, stepMs } = FEEDBACK_TOKENS.holdRotate;
  const secondPressAt = 420;

  it('holds the second press down', () => {
    expect(gesturePose(kind, 300).held).toBe(false);
    expect(gesturePose(kind, 1000).held).toBe(true);
    expect(gesturePose(kind, 1000).press).toBe(1);
  });

  it('turns after the hold delay and then every step, using the game timings', () => {
    const first = secondPressAt + delayMs;
    expect(gesturePose(kind, first - 1).turns).toBe(0);
    expect(gesturePose(kind, first + 1).turns).toBe(1);
    expect(gesturePose(kind, first + stepMs - 1).turns).toBe(1);
    expect(gesturePose(kind, first + stepMs + 1).turns).toBe(2);
  });

  it('pulses right after a turn and settles', () => {
    const first = secondPressAt + delayMs;
    expect(gesturePose(kind, first + 1).turnPulse).toBeGreaterThan(0.9);
    expect(gesturePose(kind, first + 400).turnPulse).toBe(0);
  });

  it('lets go at the end of the hold and clears the turns', () => {
    const after = gesturePose(kind, 2900);
    expect(after.held).toBe(false);
    expect(after.turns).toBe(0);
    expect(after.press).toBe(0);
  });
});