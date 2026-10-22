/**
 * Music only.
 *
 * Sound effects are not here: they are synthesized from patches in
 * src/content/audio/, so they have no files, no licences and no budget.
 * The two tracks below are sourced by the reviewer and live in public/audio/.
 */

export type TrackId = 'music-sky' | 'music-stele';
export const TRACK_IDS: readonly TrackId[] = ['music-sky', 'music-stele'];

export type AudioLicense = 'CC0-1.0' | 'Pixabay';
export const AUDIO_LICENSES: readonly AudioLicense[] = ['CC0-1.0', 'Pixabay'];

export type MusicAsset = {
  id: TrackId;
  files: readonly string[];
  source: { title: string; author: string; url: string; license: AudioLicense };
};

/**
 * Fill both rows from what the reviewer supplies (index stop point 2):
 * the real title, author, page URL and licence, and the file names they
 * placed in public/audio/. Add 'music-sky.m4a' to files only if iOS is
 * targeted; .ogg covers Chrome and the Android WebView.
 * The source fields are intentionally blank until Task 9b supplies them.
 */
export const MUSIC_ASSETS: readonly MusicAsset[] = [
  {
    id: 'music-sky',
    files: ['music-sky.ogg'],
    source: {
      title: 'Starry Arpeggio',
      author: 'Suno AI',
      url: 'https://suno.com',
      license: 'CC0-1.0',
    },
  },
  {
    id: 'music-stele',
    files: ['music-stele.ogg'],
    source: {
      title: 'Meditative Silence',
      author: 'Suno AI',
      url: 'https://suno.com',
      license: 'CC0-1.0',
    },
  },
];

export function musicUrls(id: TrackId): string[] {
  const asset = MUSIC_ASSETS.find((a) => a.id === id);
  return asset ? asset.files.map((file) => `audio/${file}`) : [];
}
