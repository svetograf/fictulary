import {
  DictionaryWord,
  DictionaryWordDetails,
  WordDefinition,
  WordStatus,
} from '@fictulary/shared/models';

export const phone: DictionaryWord = {
  wordId: '12',
  word: 'phone',
  status: WordStatus.UNKNOWN,
  count: 42,
  bookCount: 2,
};

export const phoneDetails: DictionaryWordDetails = {
  ...phone,
  books: [
    { bookId: 3, name: 'Tale', count: 40 },
    { bookId: 4, name: 'Notes', count: 2 },
  ],
};

export const phoneDefinition: WordDefinition = {
  word: 'phone',
  meanings: [
    {
      partOfSpeech: 'noun',
      definitions: [
        {
          definition:
            'electronic equipment that converts sound into electrical signals',
          examples: ['I talked to him on the telephone'],
        },
      ],
      synonyms: ['telephone', 'telephone set'],
    },
    {
      partOfSpeech: 'verb',
      definitions: [
        {
          definition:
            'get or try to get into communication (with someone) by telephone',
          examples: [
            'I tried to call you all night',
            'Take two aspirin and call me in the morning',
          ],
        },
      ],
      synonyms: ['call', 'ring'],
    },
  ],
  source: {
    name: 'WordNet 3.1, Princeton University',
    url: 'https://wordnet.princeton.edu/',
  },
  license: {
    name: 'WordNet License',
    url: 'https://wordnet.princeton.edu/license-and-commercial-use',
  },
};

export const word = (
  id: string,
  status = WordStatus.KNOWN,
): DictionaryWord => ({
  wordId: id,
  word: `word${id}`,
  status,
  count: 10,
  bookCount: 1,
});
