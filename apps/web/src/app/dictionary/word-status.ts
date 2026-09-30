import { WordStatus } from '@fictulary/shared/models';

export const WORD_STATUSES = [
  WordStatus.KNOWN,
  WordStatus.LEARNING,
  WordStatus.UNKNOWN,
];

export const WORD_STATUS_LABELS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'Known',
  [WordStatus.LEARNING]: 'Learning',
  [WordStatus.UNKNOWN]: 'Unknown',
};

export const WORD_STATUS_ICONS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'task_alt',
  [WordStatus.LEARNING]: 'school',
  [WordStatus.UNKNOWN]: 'help_outline',
};

/** The statuses a word can be moved to from its current one. */
export function otherStatuses(status: WordStatus): WordStatus[] {
  return WORD_STATUSES.filter((s) => s !== status);
}
