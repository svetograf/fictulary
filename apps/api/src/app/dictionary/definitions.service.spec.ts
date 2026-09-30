import { NotFoundException } from '@nestjs/common';
import { DefinitionsService } from './definitions.service';

// Runs against the real WordNet data bundled with wordnet-db: lookups are
// local and deterministic, so there's nothing to mock.
describe('DefinitionsService', () => {
  const service = new DefinitionsService();

  it('groups senses by part of speech, the one with most senses first', async () => {
    const run = await service.lookup('run');

    expect(run.word).toBe('run');
    // 41 verb senses, 16 noun senses.
    expect(run.meanings.map((m) => m.partOfSpeech)).toEqual(['verb', 'noun']);
    const verb = run.meanings[0];
    expect(verb.definitions[0].definition).toBe(
      "move fast by using one's feet, with one foot off the ground at any given time",
    );
    expect(verb.definitions[0].examples).toContain(
      "Don't run--you'll be out of breath",
    );
  });

  it('caps the number of senses per part of speech', async () => {
    const run = await service.lookup('run');
    // WordNet has 41 verb senses of "run".
    expect(run.meanings[0].definitions).toHaveLength(10);
  });

  it('keeps definitions of long entries intact', async () => {
    const be = await service.lookup('be');
    // The verb comes first, not the noun sense (beryllium).
    expect(be.meanings.map((m) => m.partOfSpeech)).toEqual(['verb', 'noun']);
    expect(be.meanings[0].definitions[0]).toEqual({
      definition: 'have the quality of being',
      examples: [
        '(copula, used with an adjective or a predicate noun)',
        'John is rich',
        'This is not a good answer',
      ],
    });
  });

  it('lists synonyms without the word itself, with spaces for underscores', async () => {
    const phone = await service.lookup('phone');
    // 3 noun senses, 1 verb sense.
    expect(phone.meanings.map((m) => m.partOfSpeech)).toEqual(['noun', 'verb']);
    const noun = phone.meanings.find((m) => m.partOfSpeech === 'noun');
    expect(noun?.synonyms).toContain('telephone set');
    expect(noun?.synonyms).not.toContain('phone');
  });

  it('merges adjective satellites into adjectives', async () => {
    const known = await service.lookup('well-known');
    expect(known.meanings.map((m) => m.partOfSpeech)).toEqual(['adjective']);
  });

  it('looks words up case-insensitively', async () => {
    await expect(service.lookup('Narwhal')).resolves.toMatchObject({
      meanings: [{ partOfSpeech: 'noun' }],
    });
  });

  it('credits WordNet as its license requires', async () => {
    const narwhal = await service.lookup('narwhal');
    expect(narwhal.source.name).toContain('WordNet');
    expect(narwhal.license.url).toBe(
      'https://wordnet.princeton.edu/license-and-commercial-use',
    );
  });

  it('reports words WordNet does not know', async () => {
    await expect(service.lookup('qzxv')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
