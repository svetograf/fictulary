import { tokenize } from './tokenize';

describe('tokenize', () => {
  const words = (text: string) => [...tokenize(text)];

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
});
