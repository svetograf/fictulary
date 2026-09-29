import { InitialSchema1790692728471 } from './1790692728471-InitialSchema';
import { BookWordsManyToMany1790694098096 } from './1790694098096-BookWordsManyToMany';

/**
 * All migrations, in order. The app is bundled with webpack, so migrations
 * can't be discovered with a file glob at runtime: add each new migration
 * class here after generating it.
 */
export const migrations = [
  InitialSchema1790692728471,
  BookWordsManyToMany1790694098096,
];
