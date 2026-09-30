declare module 'wordpos' {
  /** A WordNet synset, as returned by wordpos. */
  export interface Synset {
    /** n (noun), v (verb), a (adjective), s (adjective satellite), r (adverb). */
    pos: 'n' | 'v' | 'a' | 's' | 'r';
    lemma: string;
    synonyms: string[];
    def: string;
    exp: string[];
  }

  export default class WordPOS {
    constructor(options?: { profile?: boolean; stopwords?: boolean });
    lookup(word: string): Promise<Synset[]>;
  }
}
