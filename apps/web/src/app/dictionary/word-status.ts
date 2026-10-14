import {
  NameKind,
  READING_STATUSES,
  WordStatus,
} from '@fictulary/shared/models';

/** Every status, in the order filters and menus show them. */
export const WORD_STATUSES = [
  WordStatus.KNOWN,
  WordStatus.LEARNING,
  WordStatus.UNKNOWN,
  WordStatus.NAME,
  WordStatus.TRASH,
];

/** Statuses for words not worth learning; set from the word dialog. */
export const SET_ASIDE_STATUSES = [WordStatus.NAME, WordStatus.TRASH];

export const WORD_STATUS_LABELS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'Known',
  [WordStatus.LEARNING]: 'Learning',
  [WordStatus.UNKNOWN]: 'Unknown',
  [WordStatus.NAME]: 'Name',
  [WordStatus.TRASH]: 'Trash',
};

/** Ionicons names; registered in shared/icons.ts. */
export const WORD_STATUS_ICONS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'checkmark-circle-outline',
  [WordStatus.LEARNING]: 'school-outline',
  [WordStatus.UNKNOWN]: 'help-circle-outline',
  [WordStatus.NAME]: 'person-circle-outline',
  [WordStatus.TRASH]: 'trash-outline',
};

/**
 * The learning statuses a word can be moved to with the quick buttons.
 * Name and Trash are only set from the word dialog.
 */
export function otherStatuses(status: WordStatus): WordStatus[] {
  return READING_STATUSES.filter((s) => s !== status);
}

/** For "Probably a name (person, city)". */
export const NAME_KIND_LABELS: Record<NameKind, string> = {
  [NameKind.PERSON]: 'person',
  [NameKind.CITY]: 'city',
  [NameKind.COUNTRY]: 'country',
  [NameKind.LAKE]: 'lake',
};

/**
 * "Restore" on name lists: a word wrongly taken for a name goes back to
 * Unknown, like any other word new to the dictionary.
 */
export const RESTORE_STATUS = WordStatus.UNKNOWN;
