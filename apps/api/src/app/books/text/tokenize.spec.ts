import { Token, tokenize } from './tokenize';

describe('tokenize', () => {
  const words = (text: string) => [...tokenize(text)].map((t) => t.word);
  const tokens = (text: string) =>
    [...tokenize(text)].map(
      (t: Token) =>
        `${t.word}:${t.casing[0]}${t.sentenceStart ? ':start' : ''}`,
    );

  it('lowercases words and drops numbers and punctuation', () => {
    expect(words('Hello, World! 42 times... (really)')).toEqual([
      'hello',
      'world',
      'times',
      'really',
    ]);
  });

  it('splits hyphenated words', () => {
    expect(words('well-known')).toEqual(['well', 'known']);
  });

  it('expands contractions, including curly apostrophes', () => {
    expect(words("don't can't won't they’re I'm we'll I've she'd")).toEqual([
      'do',
      'not',
      'can',
      'not',
      'will',
      'not',
      'they',
      'be',
      'i',
      'be',
      'we',
      'will',
      'i',
      'have',
      'she',
      'would',
    ]);
  });

  it("drops possessive 's and keeps other apostrophe words", () => {
    expect(words("John's o'clock")).toEqual(['john', "o'clock"]);
  });

  it('keeps non-English letters', () => {
    expect(words('Привет, café naïve')).toEqual(['привет', 'café', 'naïve']);
  });

  describe('casing and sentence starts', () => {
    it('notes how each word was written', () => {
      expect(tokens('Then Tom saw the river')).toEqual([
        'then:c:start',
        'tom:c',
        'saw:l',
        'the:l',
        'river:l',
      ]);
    });

    it('starts sentences after . ! ? and paragraph breaks', () => {
      expect(tokens('one. Two! Three? Four… Five\n\nSix seven\nEight')).toEqual(
        [
          'one:l:start',
          'two:c:start',
          'three:c:start',
          'four:c:start',
          'five:c:start',
          'six:c:start',
          'seven:l',
          // A single line break is just wrapping.
          'eight:c',
        ],
      );
    });

    it('looks through quotes and dialogue punctuation', () => {
      expect(tokens('"Ah," said Becky. "Why?"')).toEqual([
        'ah:c:start',
        'said:l',
        'becky:c',
        'why:c:start',
      ]);
    });

    it('does not end a sentence after a title like Mr.', () => {
      expect(tokens('Mr. Thatcher and Dr. Robinson')).toEqual([
        'mr:c:start',
        'thatcher:c',
        'and:l',
        'dr:c',
        'robinson:c',
      ]);
    });

    it('treats ALL CAPS as unknown casing', () => {
      expect(tokens('CHAPTER I. The ADVENTURES of Tom')).toEqual([
        'chapter:u:start',
        'i:c',
        'the:c:start',
        'adventures:u',
        'of:l',
        'tom:c',
      ]);
    });

    it("keeps the casing of a possessive's base word", () => {
      expect(tokens("He met Tom's aunt")).toEqual([
        'he:c:start',
        'met:l',
        'tom:c',
        'aunt:l',
      ]);
    });

    it('gives words added by contractions unknown casing', () => {
      expect(tokens("He didn't go")).toEqual([
        'he:c:start',
        'did:l',
        'not:u',
        'go:l',
      ]);
    });
  });
});
