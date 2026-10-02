import { analyzeText, countWords, nameCandidates } from './count-words';

describe('analyzeText', () => {
  it('counts mid-sentence uses and how many were capitalized', () => {
    const { total, words } = analyzeText(
      'Tom came. Then Tom left, and Aunt Polly saw tom.',
    );
    expect(total).toBe(10);
    // The first "Tom" starts a sentence, so it says nothing about casing.
    expect(words.get('tom')).toEqual({
      count: 3,
      midSentence: 2,
      midSentenceCapitalized: 1,
    });
  });

  it('skips words longer than the column allows', () => {
    const { total, words } = analyzeText(`${'a'.repeat(300)} word`);
    expect(total).toBe(1);
    expect([...words.keys()]).toEqual(['word']);
  });

  it('returns zero for text without words', () => {
    expect(analyzeText('123 ... !!!').total).toBe(0);
  });
});

describe('nameCandidates', () => {
  it('picks words capitalized (nearly) every time mid-sentence', () => {
    const analysis = analyzeText(
      'Will you come? I will. Then Tom said that Tom will. Becky smiled. ' +
        'He saw Becky. London is far. He went to London.',
    );
    expect(nameCandidates(analysis).sort()).toEqual(['becky', 'london', 'tom']);
  });

  it('ignores words seen only at sentence starts', () => {
    expect(nameCandidates(analyzeText('Ah. Ah! Ah?'))).toEqual([]);
  });

  it('tolerates the odd lowercase use', () => {
    const text = `${'He saw Tom. '.repeat(10)}He saw tom.`;
    expect(nameCandidates(analyzeText(text))).toContain('tom');
  });
});

describe('countWords', () => {
  it('groups word forms under their base form', () => {
    const { total, counts } = countWords(
      analyzeText(
        'I was here. They were there. Be nice! My phone, your phones.',
      ),
    );
    expect(total).toBe(12);
    expect(counts.get('be')).toBe(3);
    expect(counts.get('phone')).toBe(2);
    expect(counts.has('was')).toBe(false);
  });

  it('keeps names as written instead of lemmatizing them', () => {
    const analysis = analyzeText('He sailed to Wales. Mr. Rogers waited.');
    const { counts, names } = countWords(
      analysis,
      new Set(['wales', 'rogers']),
    );
    expect(counts.get('wales')).toBe(1);
    expect(counts.get('rogers')).toBe(1);
    expect(counts.has('wale')).toBe(false);
    expect(names).toEqual(new Set(['wales', 'rogers']));
  });

  it('lemmatizes the same words when they are not names', () => {
    const { counts, names } = countWords(analyzeText('Old wales and rogers.'));
    expect(counts.has('wales')).toBe(false);
    expect(names.size).toBe(0);
  });
});
