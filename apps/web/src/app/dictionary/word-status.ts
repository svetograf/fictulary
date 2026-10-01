import { READING_STATUSES, WordStatus } from '@fictulary/shared/models';

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

export const WORD_STATUS_ICONS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'task_alt',
  [WordStatus.LEARNING]: 'school',
  [WordStatus.UNKNOWN]: 'help_outline',
  [WordStatus.NAME]: 'badge',
  [WordStatus.TRASH]: 'delete',
};

/**
 * The learning statuses a word can be moved to with the quick buttons.
 * Name and Trash are only set from the word dialog.
 */
export function otherStatuses(status: WordStatus): WordStatus[] {
  return READING_STATUSES.filter((s) => s !== status);
}
