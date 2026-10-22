import songTinh from './levels/1-1.json';
import baoThap from './levels/1-2.json';
import canhChim from './levels/1-3.json';
import haiDang from './levels/1-4.json';
import thuyenSao from './levels/1-5.json';
import vuongMien from './levels/1-6.json';
import chongChongGio from './levels/1-7.json';
import loiChiaSai from './levels/1-8.json';
import suonNuiTinhTu from './levels/1-9.json';
import baoNgocLucGiac from './levels/1-10.json';
import muiTen from './levels/2-1.json';
import canhBuom from './levels/2-2.json';
import traiTim from './levels/2-3.json';
import matTienTri from './levels/2-4.json';
import dongHoCat from './levels/2-5.json';
import daiAn from './levels/2-6.json';
import nhatNguyet from './levels/2-7.json';
import mandala from './levels/2-13.json';
import thuyenBuom from './levels/2-8.json';
import meoThan from './levels/2-9.json';
import hoaSen from './levels/2-10.json';
import kimTuThap from './levels/2-11.json';
import saoBatPhuong from './levels/2-12.json';
import manMan27 from './levels/2-14.json';
import manMan28 from './levels/2-15.json';
import manMan29 from './levels/2-16.json';
import manMan210 from './levels/2-17.json';
import manMan211 from './levels/2-18.json';
import manMan212 from './levels/2-19.json';
import manMan213 from './levels/2-20.json';
import manMan214 from './levels/2-21.json';
import manMan215 from './levels/2-22.json';
import manMan216 from './levels/2-23.json';
import manMan217 from './levels/2-24.json';
import manMan218 from './levels/2-25.json';
import manMan219 from './levels/2-26.json';
import manMan220 from './levels/2-27.json';
import manMan221 from './levels/2-28.json';
import laBanGio from './levels/3-1.json';
import luoiKiemThienThe from './levels/3-2.json';
import thuyenCoNgu from './levels/3-3.json';
import banhXeSoPhan from './levels/3-4.json';
import mauTenGio from './levels/3-5.json';
import thuyenBuomThienHa from './levels/3-6.json';
import saoTuPhuong from './levels/3-7.json';
import cungTenLienHoan from './levels/3-8.json';
import tenLuaTienTri from './levels/3-9.json';
import daiAnLuanChuyen from './levels/3-10.json';
import level3_11 from './levels/3-11.json';
import level3_12 from './levels/3-12.json';
import level3_13 from './levels/3-13.json';
import level3_14 from './levels/3-14.json';
import level3_15 from './levels/3-15.json';
import level3_16 from './levels/3-16.json';
import level3_17 from './levels/3-17.json';
import level3_18 from './levels/3-18.json';
import level3_19 from './levels/3-19.json';
import level3_20 from './levels/3-20.json';
import { campaignManifest } from './manifest.ts';
import { validateLevel } from './validate.ts';
import { DEV_LEVEL_DOCUMENTS } from './devLevels.ts';
import type { Level } from '../domain/model.ts';
import { TARGET_SNAP_RADIUS_SQ } from '../domain/freePlacement.ts';
import type { FtueStep } from '../application/ftue.ts';

const documents: Record<string, unknown> = {
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
  '2-1': muiTen,
  '2-2': canhBuom,
  '2-3': traiTim,
  '2-4': matTienTri,
  '2-5': dongHoCat,
  '2-6': daiAn,
  '2-7': nhatNguyet,
  '2-13': mandala,
  '2-8': thuyenBuom,
  '2-9': meoThan,
  '2-10': hoaSen,
  '2-11': kimTuThap,
  '2-12': saoBatPhuong,
  '2-14': manMan27,
  '2-15': manMan28,
  '2-16': manMan29,
  '2-17': manMan210,
  '2-18': manMan211,
  '2-19': manMan212,
  '2-20': manMan213,
  '2-21': manMan214,
  '2-22': manMan215,
  '2-23': manMan216,
  '2-24': manMan217,
  '2-25': manMan218,
  '2-26': manMan219,
  '2-27': manMan220,
  '2-28': manMan221,
  '3-1': laBanGio,
  '3-2': luoiKiemThienThe,
  '3-3': thuyenCoNgu,
  '3-4': banhXeSoPhan,
  '3-5': mauTenGio,
  '3-6': thuyenBuomThienHa,
  '3-7': saoTuPhuong,
  '3-8': cungTenLienHoan,
  '3-9': tenLuaTienTri,
  '3-10': daiAnLuanChuyen,
  '3-11': level3_11,
  '3-12': level3_12,
  '3-13': level3_13,
  '3-14': level3_14,
  '3-15': level3_15,
  '3-16': level3_16,
  '3-17': level3_17,
  '3-18': level3_18,
  '3-19': level3_19,
  '3-20': level3_20,
};

const globStudioDocs: Record<string, unknown> = import.meta.env.DEV
  ? (import.meta.glob('./studio/levels/*.json', { eager: true, import: 'default' }) as Record<string, unknown>)
  : {};

function findStudioDoc(id: string, studioLevelsOverride?: Record<string, unknown>): unknown | undefined {
  if (studioLevelsOverride && id in studioLevelsOverride) {
    return studioLevelsOverride[id];
  }
  if (!import.meta.env.DEV) {
    return undefined;
  }
  for (const [path, doc] of Object.entries(globStudioDocs)) {
    if (doc && typeof doc === 'object' && 'id' in doc && (doc as { id: unknown }).id === id) {
      return doc;
    }
    const match = path.match(/([^/\\]+)\.json$/);
    if (match && match[1] === id) {
      return doc;
    }
  }
  return undefined;
}

/** Bước hướng dẫn của một màn campaign (rỗng nếu màn không có hoặc không có dữ liệu). */
export function ftueStepsOf(levelId: string): readonly FtueStep[] {
  const doc = documents[levelId] as { ftueSteps?: FtueStep[] } | undefined;
  return doc?.ftueSteps ?? [];
}

/** Campaign chapters whose drops snap onto the answer; widen after playtest. */
export const CAMPAIGN_TARGET_SNAP_CHAPTERS: readonly number[] = [1, 2, 3];

function withCampaignSnap(level: Level): Level {
  return CAMPAIGN_TARGET_SNAP_CHAPTERS.includes(level.chapter) ? { ...level, targetSnapRadiusSq: TARGET_SNAP_RADIUS_SQ } : level;
}

/**
 * Tải và xác thực dữ liệu màn chơi theo chế độ truy cập (campaign hoặc harness).
 * - campaign: chỉ cho phép màn đã đạt status 'approved'.
 * - harness: cho phép màn có status 'validated' hoặc 'approved', màn dev, và màn studio khi DEV.
 */
export function loadLevel(
  id: string,
  mode: 'campaign' | 'harness',
  studioLevelsOverride?: Record<string, unknown>
): Level {
  // Campaign mode: chỉ nạp màn approved từ campaign manifest
  if (mode === 'campaign') {
    const entry = campaignManifest.find((e) => e.id === id);
    if (!entry || entry.status !== 'approved') {
      throw new Error(`unavailable:${id}`);
    }
    const doc = documents[id];
    if (!doc) {
      throw new Error(`missing-document:${id}`);
    }
    const result = validateLevel(doc);
    if (!result.ok) {
      throw new Error(`validation-failed:${id} -> ${JSON.stringify(result.issues)}`);
    }
    return withCampaignSnap(result.level);
  }

  // Harness mode: tìm theo thứ tự manifest -> devLevels -> studioLevels (ST-07)
  const entry = campaignManifest.find((e) => e.id === id);
  if (entry) {
    if (!['validated', 'approved'].includes(entry.status)) {
      throw new Error(`unavailable:${id}`);
    }
    const doc = documents[id];
    if (!doc) {
      throw new Error(`missing-document:${id}`);
    }
    const result = validateLevel(doc);
    if (!result.ok) {
      throw new Error(`validation-failed:${id} -> ${JSON.stringify(result.issues)}`);
    }
    return withCampaignSnap(result.level);
  }

  if (import.meta.env.DEV && id in DEV_LEVEL_DOCUMENTS) {
    const result = validateLevel(DEV_LEVEL_DOCUMENTS[id]);
    if (!result.ok) {
      throw new Error(`validation-failed:${id} -> ${JSON.stringify(result.issues)}`);
    }
    return result.level;
  }

  if (import.meta.env.DEV || studioLevelsOverride) {
    const studioDoc = findStudioDoc(id, studioLevelsOverride);
    if (studioDoc) {
      const result = validateLevel(studioDoc);
      if (!result.ok) {
        throw new Error(`validation-failed:${id} -> ${JSON.stringify(result.issues)}`);
      }
      return result.level;
    }
  }

  throw new Error(`unavailable:${id}`);
}
