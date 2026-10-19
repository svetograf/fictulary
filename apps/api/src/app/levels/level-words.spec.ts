import { CefrLevel } from '@fictulary/shared/models';
import { levelWords } from './level-words';

describe('levelWords', () => {
  it('includes the words of lower levels', () => {
    const a1 = levelWords(CefrLevel.A1);
    const b1 = levelWords(CefrLevel.B1);
    expect(a1.has('house')).toBe(true);
    expect(a1.has('abandon')).toBe(false);
    expect(b1.has('abandon')).toBe(true);
    for (const word of a1) {
      expect(b1.has(word)).toBe(true);
    }
  });

  it('groups word forms like book words', () => {
    // "glasses" (A1) is counted under "glass" in books too.
    expect(levelWords(CefrLevel.A1).has('glass')).toBe(true);
    expect(levelWords(CefrLevel.A1).has('glasses')).toBe(false);
  });

  it('keeps single words only, with spelling variants', () => {
    const b2 = levelWords(CefrLevel.B2);
    expect(b2.has('colour')).toBe(true);
    expect(b2.has('color')).toBe(true);
    expect([...b2].some((word) => word.includes(' '))).toBe(false);
  });
});
