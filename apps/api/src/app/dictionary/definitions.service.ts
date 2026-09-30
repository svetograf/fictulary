import { WordDefinition } from '@fictulary/shared/models';
import { Injectable, NotFoundException } from '@nestjs/common';
import WordPOS, { Synset } from 'wordpos';

/** Senses shown per part of speech; "run" alone has 41 as a verb. */
const MAX_SENSES_PER_POS = 10;
const MAX_SYNONYMS = 10;

const PARTS_OF_SPEECH: { name: string; codes: Synset['pos'][] }[] = [
  { name: 'noun', codes: ['n'] },
  { name: 'verb', codes: ['v'] },
  // Satellites are adjectives clustered around a head adjective.
  { name: 'adjective', codes: ['a', 's'] },
  { name: 'adverb', codes: ['r'] },
];

const SOURCE = {
  name: 'WordNet 3.1, Princeton University',
  url: 'https://wordnet.princeton.edu/',
};
const LICENSE = {
  name: 'WordNet License',
  url: 'https://wordnet.princeton.edu/license-and-commercial-use',
};

/**
 * English definitions from WordNet, read locally from the wordnet-db files
 * (binary search on disk, so no network and little memory).
 */
@Injectable()
export class DefinitionsService {
  private readonly wordnet = new WordPOS({ profile: false, stopwords: false });

  async lookup(word: string): Promise<WordDefinition> {
    const synsets = await this.wordnet.lookup(word.toLowerCase());

    const meanings = PARTS_OF_SPEECH.map(({ name, codes }) => ({
      name,
      // WordNet lists senses most frequent first.
      senses: synsets.filter((synset) => codes.includes(synset.pos)),
    }))
      .filter(({ senses }) => senses.length > 0)
      // Most senses first: a rough proxy for the word's main use ("be" has 13
      // verb senses and one noun sense, beryllium). Ties keep the order above.
      .sort((a, b) => b.senses.length - a.senses.length)
      .map(({ name, senses }) => ({
        partOfSpeech: name,
        definitions: senses.slice(0, MAX_SENSES_PER_POS).map((synset) => ({
          definition: synset.def.trim(),
          examples: synset.exp.map((example) => example.trim()),
        })),
        synonyms: synonyms(word, senses),
      }));

    if (meanings.length === 0) {
      throw new NotFoundException(`No definition found for "${word}"`);
    }
    return { word, meanings, source: SOURCE, license: LICENSE };
  }
}

/** Words sharing the senses, in WordNet order, without the word itself. */
function synonyms(word: string, senses: Synset[]): string[] {
  const seen = new Set([word.toLowerCase()]);
  const result: string[] = [];
  for (const synonym of senses.flatMap((sense) => sense.synonyms)) {
    const text = synonym.replace(/_/g, ' ');
    if (!seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      result.push(text);
    }
  }
  return result.slice(0, MAX_SYNONYMS);
}
