import { buildLevelDocument, type LevelSource } from '../../src/content/authoring.ts';
import type { Level } from '../../src/domain/model.ts';
import { validateLevel } from '../../src/content/validate.ts';
import { songTinh } from './anchorSources/1-1.ts';
import { baoThap } from './anchorSources/1-2.ts';
import { canhChim } from './anchorSources/1-3.ts';
import { haiDang } from './anchorSources/1-4.ts';
import { thuyenSao } from './anchorSources/1-5.ts';
import { vuongMien } from './anchorSources/1-6.ts';
import { chongChongGio } from './anchorSources/1-7.ts';
import { loiChiaSai } from './anchorSources/1-8.ts';
import { suonNuiTinhTu } from './anchorSources/1-9.ts';
import { baoNgocLucGiac } from './anchorSources/1-10.ts';
import * as ch2_1 from './anchorSources/2-1.ts';
import * as ch2_2 from './anchorSources/2-2.ts';
import * as ch2_3 from './anchorSources/2-3.ts';
import * as ch2_4 from './anchorSources/2-4.ts';
import * as ch2_5 from './anchorSources/2-5.ts';
import * as ch2_6 from './anchorSources/2-6.ts';
import * as ch2_7 from './anchorSources/2-7.ts';
import * as ch2_8 from './anchorSources/2-8.ts';
import * as ch2_9 from './anchorSources/2-9.ts';
import * as ch2_25 from './anchorSources/2-25.ts';
import * as ch3_1 from './anchorSources/3-1.ts';
import * as ch3_2 from './anchorSources/3-2.ts';
import * as ch3_3 from './anchorSources/3-3.ts';
import * as ch3_4 from './anchorSources/3-4.ts';
import * as ch2_10 from './anchorSources/2-10.ts';
import * as ch2_11 from './anchorSources/2-11.ts';
import * as ch2_12 from './anchorSources/2-12.ts';
import * as ch2_13 from './anchorSources/2-13.ts';
import * as ch2_14 from './anchorSources/2-14.ts';
import * as ch2_15 from './anchorSources/2-15.ts';
import * as ch2_16 from './anchorSources/2-16.ts';
import * as ch2_17 from './anchorSources/2-17.ts';
import * as ch2_18 from './anchorSources/2-18.ts';
import * as ch2_19 from './anchorSources/2-19.ts';
import * as ch2_20 from './anchorSources/2-20.ts';
import * as ch2_21 from './anchorSources/2-21.ts';
import * as ch2_22 from './anchorSources/2-22.ts';
import * as ch2_23 from './anchorSources/2-23.ts';
import * as ch2_24 from './anchorSources/2-24.ts';
import * as ch2_26 from './anchorSources/2-26.ts';
import * as ch2_27 from './anchorSources/2-27.ts';
import * as ch2_28 from './anchorSources/2-28.ts';

/**
 * Chapters 1, 2 and 3-1…3-4 as they were before they moved
 * to free placement: fixed anchors plus decoys.
 * Frozen copies kept so tests of anchor-mode mechanics (snapping, decoys, shared
 * anchors, solver on anchor poses, difficulty calibration) keep real data.
 */
export const ANCHOR_SOURCES: Record<string, LevelSource> = {
  '1-1': songTinh,
  '1-2': baoThap,
  '1-3': canhChim,
  '1-4': haiDang,
  '1-5': thuyenSao,
  '1-6': vuongMien,
  '1-7': chongChongGio,
  '1-8': loiChiaSai,
  '1-9': suonNuiTinhTu,
  '1-10': baoNgocLucGiac,
  '2-1': Object.values(ch2_1)[0] as LevelSource,
  '2-2': Object.values(ch2_2)[0] as LevelSource,
  '2-3': Object.values(ch2_3)[0] as LevelSource,
  '2-4': Object.values(ch2_4)[0] as LevelSource,
  '2-5': Object.values(ch2_5)[0] as LevelSource,
  '2-6': Object.values(ch2_6)[0] as LevelSource,
  '2-7': Object.values(ch2_7)[0] as LevelSource,
  '2-8': Object.values(ch2_8)[0] as LevelSource,
  '2-9': Object.values(ch2_9)[0] as LevelSource,
  '2-25': Object.values(ch2_25)[0] as LevelSource,
  '3-1': Object.values(ch3_1)[0] as LevelSource,
  '3-2': Object.values(ch3_2)[0] as LevelSource,
  '3-3': Object.values(ch3_3)[0] as LevelSource,
  '3-4': Object.values(ch3_4)[0] as LevelSource,
  '2-10': Object.values(ch2_10)[0] as LevelSource,
  '2-11': Object.values(ch2_11)[0] as LevelSource,
  '2-12': Object.values(ch2_12)[0] as LevelSource,
  '2-13': Object.values(ch2_13)[0] as LevelSource,
  '2-14': Object.values(ch2_14)[0] as LevelSource,
  '2-15': Object.values(ch2_15)[0] as LevelSource,
  '2-16': Object.values(ch2_16)[0] as LevelSource,
  '2-17': Object.values(ch2_17)[0] as LevelSource,
  '2-18': Object.values(ch2_18)[0] as LevelSource,
  '2-19': Object.values(ch2_19)[0] as LevelSource,
  '2-20': Object.values(ch2_20)[0] as LevelSource,
  '2-21': Object.values(ch2_21)[0] as LevelSource,
  '2-22': Object.values(ch2_22)[0] as LevelSource,
  '2-23': Object.values(ch2_23)[0] as LevelSource,
  '2-24': Object.values(ch2_24)[0] as LevelSource,
  '2-26': Object.values(ch2_26)[0] as LevelSource,
  '2-27': Object.values(ch2_27)[0] as LevelSource,
  '2-28': Object.values(ch2_28)[0] as LevelSource,
};

export function anchorDocument(id: string) {
  return buildLevelDocument(ANCHOR_SOURCES[id]);
}

export function anchorLevel(id: string): Level {
  const result = validateLevel(anchorDocument(id));
  if (!result.ok) throw new Error(`anchor fixture ${id}: ${JSON.stringify(result.issues)}`);
  return result.level;
}
