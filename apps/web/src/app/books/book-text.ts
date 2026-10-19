import { BOOK_FILE_MAX_SIZE } from '@fictulary/shared/models';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Observable, from, of } from 'rxjs';
import { utf8Bytes } from './file-validators';

/**
 * Ebooks are turned into plain text in the browser and uploaded as .txt, so
 * the API only ever sees text. BOOK_FILE_MAX_SIZE limits that text; the
 * ebook itself may be bigger (images, fonts, compression).
 */
/** FB2 books are often distributed zipped, as .fb2.zip. */
export const EBOOK_EXTENSIONS = ['.epub', '.fb2', '.fb2.zip'];
export const BOOK_FILE_EXTENSIONS = ['.txt', ...EBOOK_EXTENSIONS];
export const EBOOK_FILE_MAX_SIZE = 20 * 1024 * 1024;

export type BookFileProblem = 'unreadable' | 'protected';

export class BookFileError extends Error {
  constructor(readonly problem: BookFileProblem) {
    super(
      problem === 'protected'
        ? 'The book is DRM-protected'
        : 'The book could not be read',
    );
  }
}

export function isEbook(file: File): boolean {
  const name = file.name.toLowerCase();
  return EBOOK_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/** The file name without its extension: "Emma.fb2.zip" -> "Emma". */
export function bookBaseName(fileName: string): string {
  return fileName.replace(/(\.fb2)?\.[^.]+$/i, '');
}

/** The book's text: paragraphs separated by blank lines. */
export async function extractBookText(file: File): Promise<string> {
  const data = await readBytes(file);
  try {
    const name = file.name.toLowerCase();
    return name.endsWith('.epub')
      ? await epubText(data)
      : name.endsWith('.zip')
        ? fb2Text(await unzippedFb2(data))
        : fb2Text(data);
  } catch (error) {
    throw error instanceof BookFileError
      ? error
      : new BookFileError('unreadable');
  }
}

type Extraction = { text: string } | { problem: BookFileProblem };

/** Each ebook is read once: by the validator, then again on upload. */
const extractions = new WeakMap<File, Promise<Extraction>>();

function extraction(file: File): Promise<Extraction> {
  let result = extractions.get(file);
  if (!result) {
    result = extractBookText(file).then(
      (text) => ({ text }),
      (error: unknown) => ({
        problem: error instanceof BookFileError ? error.problem : 'unreadable',
      }),
    );
    extractions.set(file, result);
  }
  return result;
}

/**
 * Async validator for the chosen file: an ebook must be readable, not
 * DRM-protected, and hold some text no bigger than a .txt upload.
 */
export function readableBook(
  control: AbstractControl<File | null>,
): Observable<ValidationErrors | null> {
  const file = control.value;
  // Synchronous for anything else, so the control is never PENDING for it.
  return file && isEbook(file) ? from(ebookErrors(file)) : of(null);
}

async function ebookErrors(file: File): Promise<ValidationErrors | null> {
  const result = await extraction(file);
  if ('problem' in result) {
    return result.problem === 'protected'
      ? { protectedBook: true }
      : { unreadableBook: true };
  }
  if (!result.text) {
    return { noText: true };
  }
  const bytes = utf8Bytes(result.text);
  return bytes > BOOK_FILE_MAX_SIZE
    ? { maxTextBytes: { maxBytes: BOOK_FILE_MAX_SIZE, actualBytes: bytes } }
    : null;
}

/** The ebook's text as the .txt file the API accepts. */
export async function bookTextFile(file: File): Promise<File> {
  const result = await extraction(file);
  if ('problem' in result) {
    throw new BookFileError(result.problem);
  }
  const name = bookBaseName(file.name) + '.txt';
  return new File([result.text], name, { type: 'text/plain' });
}

// --- EPUB: a ZIP of XHTML chapters, listed in reading order by the OPF ---

async function epubText(data: Uint8Array): Promise<string> {
  const { unzipSync } = await import('fflate');
  // Unzip only the entries needed, never the images.
  const read = (paths: Iterable<string>) => {
    const wanted = new Set(paths);
    return unzipSync(data, { filter: (entry) => wanted.has(entry.name) });
  };

  const meta = read(['META-INF/container.xml', 'META-INF/encryption.xml']);
  const container = meta['META-INF/container.xml'];
  if (!container) {
    throw new BookFileError('unreadable');
  }
  const opfPath = parseXml(decodeText(container))
    .getElementsByTagNameNS('*', 'rootfile')[0]
    ?.getAttribute('full-path');
  if (!opfPath) {
    throw new BookFileError('unreadable');
  }

  const opfBytes = read([opfPath])[opfPath];
  if (!opfBytes) {
    throw new BookFileError('unreadable');
  }
  const opf = parseXml(decodeText(opfBytes));
  const hrefs = new Map<string, string>();
  for (const item of opf.getElementsByTagNameNS('*', 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const properties = item.getAttribute('properties') ?? '';
    // The table of contents is navigation, not the book's text.
    if (id && href && !properties.split(/\s+/).includes('nav')) {
      hrefs.set(id, resolvePath(opfPath, href));
    }
  }
  const chapters = [...opf.getElementsByTagNameNS('*', 'itemref')]
    .filter((itemref) => itemref.getAttribute('linear') !== 'no')
    .map((itemref) => hrefs.get(itemref.getAttribute('idref') ?? ''))
    .filter((path): path is string => !!path);
  if (chapters.length === 0) {
    throw new BookFileError('unreadable');
  }

  const encryption = meta['META-INF/encryption.xml'];
  if (encryption && encrypts(decodeText(encryption), chapters)) {
    throw new BookFileError('protected');
  }

  const files = read(chapters);
  return joinBlocks(
    chapters.map((path) => {
      const bytes = files[path];
      if (!bytes) {
        return '';
      }
      // Chapters are XHTML, but the lenient HTML parser also copes with
      // the broken markup and undeclared entities (&nbsp;) many books have.
      const doc = new DOMParser().parseFromString(
        decodeText(bytes),
        'text/html',
      );
      return doc.body ? blockText(doc.body) : '';
    }),
  );
}

/**
 * Whether encryption.xml covers any chapter: DRM. Fonts alone are often
 * obfuscated in DRM-free books, which doesn't affect the text.
 */
function encrypts(encryptionXml: string, chapters: string[]): boolean {
  const encrypted = new Set(
    [...parseXml(encryptionXml).getElementsByTagNameNS('*', 'CipherReference')]
      .map((reference) => reference.getAttribute('URI'))
      .filter((uri): uri is string => !!uri)
      .map((uri) => resolvePath('', uri)),
  );
  return chapters.some((path) => encrypted.has(path));
}

/** A ZIP entry name for `href`, relative to the entry `from`. */
function resolvePath(from: string, href: string): string {
  const url = new URL(href, `http://book/${from}`);
  return decodeURIComponent(url.pathname.slice(1));
}

// --- FB2: one XML file with the text in <body> elements ---

/** The .fb2 file inside a .fb2.zip. */
async function unzippedFb2(data: Uint8Array): Promise<Uint8Array> {
  const { unzipSync } = await import('fflate');
  // Only the first .fb2 entry; skip macOS resource forks (__MACOSX/._x.fb2).
  let found = false;
  const entries = unzipSync(data, {
    filter: (entry) => {
      const take =
        !found &&
        /\.fb2$/i.test(entry.name) &&
        !/(^|\/)(__MACOSX\/|\._)/.test(entry.name);
      found ||= take;
      return take;
    },
  });
  const fb2 = Object.values(entries)[0];
  if (!fb2) {
    throw new BookFileError('unreadable');
  }
  return fb2;
}

function fb2Text(data: Uint8Array): string {
  const source = decodeText(data);
  let xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) {
    // Often HTML entities (&nbsp;) or a bare "&", which XML doesn't allow.
    xml = parseXml(repairEntities(source));
  }
  const bodies = [...xml.getElementsByTagNameNS('*', 'body')];
  if (bodies.length === 0) {
    throw new BookFileError('unreadable');
  }
  return joinBlocks(bodies.map(blockText));
}

const XML_ENTITIES = new Set(['amp;', 'lt;', 'gt;', 'quot;', 'apos;']);

/** Replaces HTML named entities with their characters, escapes bare "&". */
function repairEntities(source: string): string {
  const decoded = new Map<string, string>();
  return source.replace(
    /&(#\d+;|#x[\da-f]+;|[a-z][a-z\d]*;)?/gi,
    (match, entity: string | undefined) => {
      if (!entity) {
        return '&amp;';
      }
      if (entity.startsWith('#') || XML_ENTITIES.has(entity)) {
        return match;
      }
      let char = decoded.get(entity);
      if (char === undefined) {
        char =
          new DOMParser().parseFromString(match, 'text/html').body
            .textContent ?? match;
        decoded.set(entity, char);
      }
      // An unknown name stays as text.
      return char === match ? `&amp;${entity}` : char;
    },
  );
}

// --- Shared helpers ---

/** Elements whose content is a paragraph of its own, in XHTML and FB2. */
const BLOCKS = new Set(
  (
    'address article aside blockquote dd div dl dt figcaption figure footer ' +
    'h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table td th ' +
    'tr ul ' +
    // FB2
    'annotation cite date empty-line epigraph poem stanza subtitle ' +
    'text-author title v'
  ).split(' '),
);
const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'svg']);
const PARAGRAPH = '\n\n';

/**
 * The element's text, with block elements as paragraphs so that words of
 * adjacent paragraphs don't run together and a heading without a period
 * still ends a sentence.
 */
function blockText(root: Node): string {
  const parts: string[] = [];
  const visit = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push((child as Text).data.replace(/\s+/g, ' '));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const name = (child as Element).localName.toLowerCase();
        if (SKIPPED.has(name)) {
          continue;
        }
        if (name === 'br') {
          parts.push('\n');
          continue;
        }
        const block = BLOCKS.has(name);
        if (block) parts.push(PARAGRAPH);
        visit(child);
        if (block) parts.push(PARAGRAPH);
      }
    }
  };
  visit(root);
  return parts
    .join('')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, PARAGRAPH)
    .trim();
}

function joinBlocks(texts: string[]): string {
  return texts.filter(Boolean).join(PARAGRAPH);
}

function parseXml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new BookFileError('unreadable');
  }
  return doc;
}

/**
 * Decodes an XML file by its byte order mark or `encoding` declaration;
 * FB2 books are often windows-1251.
 */
function decodeText(bytes: Uint8Array): string {
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
  } else {
    const prolog = new TextDecoder('ascii').decode(bytes.subarray(0, 200));
    encoding =
      /^\s*<\?xml[^>]*encoding=["']([\w.:-]+)["']/i.exec(prolog)?.[1] ??
      encoding;
  }
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    // An encoding the browser doesn't know.
    return new TextDecoder().decode(bytes);
  }
}

/** File.arrayBuffer() is missing in jsdom; FileReader works everywhere. */
function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new BookFileError('unreadable'));
    reader.readAsArrayBuffer(file);
  });
}
