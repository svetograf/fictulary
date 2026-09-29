import { countWords } from './count-words';

describe('countWords', () => {
  it('groups word forms under their base form', () => {
    const { total, counts } = countWords(
      'I was here. They were there. Be nice! My phone, your phones.',
    );
    expect(total).toBe(12);
    expect(counts.get('be')).toBe(3);
    expect(counts.get('phone')).toBe(2);
    expect(counts.has('was')).toBe(false);
  });

  it('skips words longer than the column allows', () => {
    const { total, counts } = countWords(`${'a'.repeat(300)} word`);
    expect(total).toBe(1);
    expect([...counts.keys()]).toEqual(['word']);
  });

  it('returns zero for text without words', () => {
    expect(countWords('123 ... !!!').total).toBe(0);
  });
});
