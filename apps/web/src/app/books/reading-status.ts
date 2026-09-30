import { WordStatus } from '@fictulary/shared/models';

/**
 * The upload form's "have you read it" choice, and the status the book's
 * words get in the uploader's dictionary.
 */
export const READING_OPTIONS: {
  status: WordStatus;
  label: string;
  hint: string;
}[] = [
  {
    status: WordStatus.UNKNOWN,
    label: 'Not read',
    hint: 'New words go to your dictionary as unknown.',
  },
  {
    status: WordStatus.LEARNING,
    label: 'Reading',
    hint: 'New words go to your dictionary as learning.',
  },
  {
    status: WordStatus.KNOWN,
    label: 'Read',
    hint: 'All its words are marked known, including ones you were learning.',
  },
];
