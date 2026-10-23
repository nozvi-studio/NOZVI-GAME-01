export type SupportedLocale = 'en-US' | 'es' | 'pt-BR' | 'fr' | 'de' | 'ja' | 'ko' | 'zh-CN' | 'id' | 'vi';

export interface LocaleMetadata {
  readonly code: SupportedLocale;
  readonly shortLabel: string;
  readonly nativeName: string;
  readonly flagEmoji: string;
}

export type CommonTranslationKey =
  | 'btn_start'
  | 'btn_continue'
  | 'btn_replay'
  | 'btn_select_level'
  | 'version_footer'
  | 'loading_fact_label'
  | 'loading_tap_hint'
  | 'loading_version'
  | 'settings_title'
  | 'setting_show_target'
  | 'setting_reduce_motion'
  | 'setting_music'
  | 'setting_sfx'
  | 'setting_haptics'
  | 'setting_language'
  | 'setting_danger_reset'
  | 'reset_confirm_message'
  | 'btn_cancel'
  | 'btn_confirm_delete'
  | 'pause_title'
  | 'pause_resume'
  | 'pause_restart'
  | 'pause_level_select'
  | 'level_select_title'
  | 'chapter_prefix'
  | 'level_prefix'
  | 'toast_level_locked'
  | 'toast_level_polishing'
  | 'map_sealed_continue'
  | 'map_sealed_chapter'
  | 'map_chapter_unlocked'
  | 'map_play'
  | 'map_coming_soon'
  | 'snap_hint'
  | 'match_count'
  | 'victory_title'
  | 'victory_next'
  | 'victory_time'
  | 'victory_best'
  | 'victory_replay'
  | 'victory_level_select'
  | 'btn_reset'
  | 'btn_rotate'
  | 'studio_brand'
  | 'lang_modal_title'
  | 'gate_endless'
  | 'gate_coming_soon'
  | 'gate_locked'
  | 'hint_rotate_first'
  | 'hint_linked_rotation'
  | 'tutorial_step_label'
  | 'tutorial_drag_title'
  | 'tutorial_drag_body'
  | 'tutorial_chip_drag'
  | 'tutorial_second_title'
  | 'tutorial_second_body'
  | 'tutorial_skip'
  | 'tutorial_select_title'
  | 'tutorial_select_body'
  | 'tutorial_select_chip'
  | 'tutorial_rotate_title'
  | 'tutorial_rotate_body'
  | 'tutorial_rotate_chip'
  | 'tutorial_turned_drag_title'
  | 'tutorial_turned_drag_body'
  | 'tutorial_final_title'
  | 'tutorial_final_body'
  | 'tutorial_tip_double_tap'
  | 'tutorial_tip_hold'
  | 'tutorial_button_title'
  | 'tutorial_button_body'
  | 'tutorial_double_title'
  | 'tutorial_double_body'
  | 'tutorial_double_chip'
  | 'tutorial_hold_title'
  | 'tutorial_hold_body'
  | 'tutorial_hold_chip';

export type CommonTranslations = Record<CommonTranslationKey, string>;

export interface GameTranslations {
  readonly chapters: Record<string, string>;
  readonly levelTitles: Record<string, string>;
  readonly taglines: readonly string[];
  readonly victoryVerses?: Record<string, string>;
  readonly chapterTaglines?: Record<string, string>;
  readonly galaxyTypes?: Record<string, string>;
  readonly chapterVerses?: Record<string, readonly string[]>;
}

export interface TranslationBundle {
  readonly common: CommonTranslations;
  readonly game: GameTranslations;
}
