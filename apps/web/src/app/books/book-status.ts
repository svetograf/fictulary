import { BookStatus } from '@fictulary/shared/models';

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  [BookStatus.NOT_READ]: 'Not read',
  [BookStatus.READING]: 'Reading',
  [BookStatus.READ]: 'Read',
};

export const BOOK_STATUS_ICONS: Record<BookStatus, string> = {
  [BookStatus.NOT_READ]: 'bookmark_border',
  [BookStatus.READING]: 'auto_stories',
  [BookStatus.READ]: 'task_alt',
};
