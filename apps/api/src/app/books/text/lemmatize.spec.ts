import { lemmatize } from './lemmatize';

describe('lemmatize', () => {
  it.each([
    ['was', 'be'],
    ['were', 'be'],
    ['is', 'be'],
    ['been', 'be'],
    ['phones', 'phone'],
    ['mice', 'mouse'],
    ['children', 'child'],
    ['went', 'go'],
    ['running', 'run'],
    ['does', 'do'],
    ['has', 'have'],
    ['cities', 'city'],
    ['better', 'good'],
  ])('%s -> %s', (word, base) => {
    expect(lemmatize(word)).toBe(base);
  });

  it.each(['this', 'his', 'us', 'as', 'news', 'data', 'phone'])(
    'keeps %s unchanged',
    (word) => {
      expect(lemmatize(word)).toBe(word);
    },
  );

  it('leaves non-English words alone', () => {
    expect(lemmatize('cafés')).toBe('cafés');
  });
});
