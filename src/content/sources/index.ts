import type { LevelSource } from '../authoring.ts';
import { songTinh } from './1-1.ts';
import { baoThap } from './1-2.ts';
import { canhChim } from './1-3.ts';
import { haiDang } from './1-4.ts';
import { thuyenSao } from './1-5.ts';
import { vuongMien } from './1-6.ts';
import { chongChongGio } from './1-7.ts';
import { loiChiaSai } from './1-8.ts';
import { suonNuiTinhTu } from './1-9.ts';
import { baoNgocLucGiac } from './1-10.ts';
import { laBanGio } from './3-1.ts';
import { luoiKiemThienThe } from './3-2.ts';
import { thuyenCoNgu } from './3-3.ts';
import { banhXeSoPhan } from './3-4.ts';
import { mauTenGio } from './3-5.ts';
import { thuyenBuomThienHa } from './3-6.ts';
import { saoTuPhuong } from './3-7.ts';
import { cungTenLienHoan } from './3-8.ts';
import { tenLuaTienTri } from './3-9.ts';
import { daiAnLuanChuyen } from './3-10.ts';
import { muiTen } from './2-1.ts';
import { canhBuom } from './2-2.ts';
import { traiTim } from './2-3.ts';
import { matTienTri } from './2-4.ts';
import { dongHoCat } from './2-5.ts';
import { daiAn } from './2-6.ts';
import { nhatNguyet } from './2-7.ts';
import { mandala } from './2-13.ts';
import { thuyenBuom } from './2-8.ts';
import { meoThan } from './2-9.ts';
import { hoaSen } from './2-10.ts';
import { kimTuThap } from './2-11.ts';
import { saoBatPhuong } from './2-12.ts';
import { manMan27 } from './2-14.ts';
import { manMan28 } from './2-15.ts';
import { manMan29 } from './2-16.ts';
import { manMan210 } from './2-17.ts';
import { manMan211 } from './2-18.ts';
import { manMan212 } from './2-19.ts';
import { manMan213 } from './2-20.ts';
import { manMan214 } from './2-21.ts';
import { manMan215 } from './2-22.ts';
import { manMan216 } from './2-23.ts';
import { manMan217 } from './2-24.ts';
import { manMan218 } from './2-25.ts';
import { manMan219 } from './2-26.ts';
import { manMan220 } from './2-27.ts';
import { manMan221 } from './2-28.ts';
import { man311 } from './3-11.ts';
import { man312 } from './3-12.ts';
import { man313 } from './3-13.ts';
import { man314 } from './3-14.ts';
import { man315 } from './3-15.ts';
import { man316 } from './3-16.ts';
import { man317 } from './3-17.ts';
import { man318 } from './3-18.ts';
import { man319 } from './3-19.ts';
import { man320 } from './3-20.ts';

/** Mọi màn có nguồn mô tả. Thêm màn mới: tạo file nguồn rồi đăng ký ở đây. */
export const LEVEL_SOURCES: Readonly<Record<string, LevelSource>> = {
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
  '3-11': man311,
  '3-12': man312,
  '3-13': man313,
  '3-14': man314,
  '3-15': man315,
  '3-16': man316,
  '3-17': man317,
  '3-18': man318,
  '3-19': man319,
  '3-20': man320,
};
