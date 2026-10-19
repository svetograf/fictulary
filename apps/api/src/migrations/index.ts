import { InitialSchema1790692728471 } from './1790692728471-InitialSchema';
import { BookWordsManyToMany1790694098096 } from './1790694098096-BookWordsManyToMany';
import { AddUsers1790697736113 } from './1790697736113-AddUsers';
import { UserDictionary1790699755830 } from './1790699755830-UserDictionary';
import { WordStatusTrashName1790860764256 } from './1790860764256-WordStatusTrashName';
import { Names1790929028764 } from './1790929028764-Names';
import { OAuthIdentities1792056799106 } from './1792056799106-OAuthIdentities';
import { KnowledgeLevel1792418680018 } from './1792418680018-KnowledgeLevel';

/**
 * All migrations, in order. The app is bundled with webpack, so migrations
 * can't be discovered with a file glob at runtime: add each new migration
 * class here after generating it.
 */
export const migrations = [
  InitialSchema1790692728471,
  BookWordsManyToMany1790694098096,
  AddUsers1790697736113,
  UserDictionary1790699755830,
  WordStatusTrashName1790860764256,
  Names1790929028764,
  OAuthIdentities1792056799106,
  KnowledgeLevel1792418680018,
];
