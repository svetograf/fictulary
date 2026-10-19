import { FormControl } from '@angular/forms';
import { strToU8, zipSync } from 'fflate';
import { firstValueFrom } from 'rxjs';
import {
  BookFileError,
  bookBaseName,
  bookTextFile,
  extractBookText,
  readableBook,
} from './book-text';

const CONTAINER = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1" href="text/chapter%201.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="cover" linear="no"/>
    <itemref idref="ch2"/>
    <itemref idref="ch1"/>
  </spine>
</package>`;

const xhtml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ignored</title>
<style>p { color: red }</style></head><body>${body}</body></html>`;

function epub(extra: Record<string, string> = {}): File {
  const entries: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(CONTAINER),
    'OEBPS/content.opf': strToU8(OPF),
    'OEBPS/nav.xhtml': strToU8(xhtml('<nav><ol><li>Contents</li></ol></nav>')),
    'OEBPS/cover.xhtml': strToU8(xhtml('<p>Cover page</p>')),
    'OEBPS/text/chapter 1.xhtml': strToU8(
      xhtml('<h1>Chapter Two</h1><p>Tom&nbsp;ran.</p><p>Then<br/>Huck.</p>'),
    ),
    'OEBPS/text/ch2.xhtml': strToU8(
      xhtml('<h1>Chapter One</h1><p>The <em>cat</em> sat.</p><p>It slept.</p>'),
    ),
  };
  for (const [name, content] of Object.entries(extra)) {
    entries[name] = strToU8(content);
  }
  return new File([zipSync(entries)], 'Tom Sawyer.epub');
}

const FB2 = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info><book-title>Metadata Title</book-title></title-info></description>
  <body>
    <title><p>Chapter One</p></title>
    <section><p>The cat sat.</p><empty-line/><p>It slept.</p>
      <poem><stanza><v>Line one</v><v>Line two</v></stanza></poem>
    </section>
  </body>
  <binary id="cover.jpg" content-type="image/jpeg">SGVsbG8=</binary>
</FictionBook>`;

const fb2 = (content: BlobPart, name = 'book.fb2') => new File([content], name);

describe('extractBookText', () => {
  it('reads EPUB chapters in spine order as paragraphs', async () => {
    await expect(extractBookText(epub())).resolves.toBe(
      [
        'Chapter One',
        'The cat sat.',
        'It slept.',
        'Chapter Two',
        'Tom ran.',
        'Then\nHuck.',
      ].join('\n\n'),
    );
  });

  it('rejects an EPUB with encrypted chapters as protected', async () => {
    const encryption = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"
  xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:CipherData>
    <enc:CipherReference URI="OEBPS/text/ch2.xhtml"/>
  </enc:CipherData></enc:EncryptedData>
</encryption>`;
    await expect(
      extractBookText(epub({ 'META-INF/encryption.xml': encryption })),
    ).rejects.toEqual(new BookFileError('protected'));
  });

  it('allows an EPUB whose only encrypted files are fonts', async () => {
    const encryption = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"
  xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:CipherData>
    <enc:CipherReference URI="OEBPS/fonts/serif.otf"/>
  </enc:CipherData></enc:EncryptedData>
</encryption>`;
    await expect(
      extractBookText(epub({ 'META-INF/encryption.xml': encryption })),
    ).resolves.toContain('The cat sat.');
  });

  it('rejects a file that is not an EPUB', async () => {
    await expect(
      extractBookText(new File(['not a zip'], 'book.epub')),
    ).rejects.toEqual(new BookFileError('unreadable'));
  });

  it('reads FB2 bodies without metadata or images', async () => {
    await expect(extractBookText(fb2(FB2))).resolves.toBe(
      ['Chapter One', 'The cat sat.', 'It slept.', 'Line one', 'Line two'].join(
        '\n\n',
      ),
    );
  });

  it('reads the FB2 inside a .fb2.zip', async () => {
    const zipped = zipSync({
      '__MACOSX/._book.fb2': strToU8('resource fork'),
      'book.fb2': strToU8(FB2),
    });
    await expect(
      extractBookText(new File([zipped], 'book.fb2.zip')),
    ).resolves.toContain('The cat sat.');
  });

  it('rejects a .fb2.zip without an FB2 in it', async () => {
    const zipped = zipSync({ 'readme.txt': strToU8('hi') });
    await expect(
      extractBookText(new File([zipped], 'book.fb2.zip')),
    ).rejects.toEqual(new BookFileError('unreadable'));
  });

  it('decodes FB2 in the encoding it declares', async () => {
    // "Кот" in windows-1251.
    const bytes = new Uint8Array([
      ...strToU8('<?xml version="1.0" encoding="windows-1251"?>'),
      ...strToU8('<FictionBook><body><p>'),
      0xca,
      0xee,
      0xf2,
      ...strToU8('</p></body></FictionBook>'),
    ]);
    await expect(extractBookText(fb2(bytes))).resolves.toBe('Кот');
  });

  it('reads FB2 with HTML entities and bare ampersands', async () => {
    const broken = FB2.replace(
      'The cat',
      'The&nbsp;cat &mdash; Tom & Co &bogus;',
    );
    await expect(extractBookText(fb2(broken))).resolves.toContain(
      'The cat \u2014 Tom & Co &bogus; sat.',
    );
  });
});

describe('readableBook', () => {
  const validate = (file: File | null) =>
    firstValueFrom(readableBook(new FormControl(file)));

  it('skips .txt files', async () => {
    await expect(validate(new File(['x'], 'a.txt'))).resolves.toBeNull();
  });

  it('reports unreadable, protected and empty books', async () => {
    await expect(validate(new File(['?'], 'a.epub'))).resolves.toEqual({
      unreadableBook: true,
    });
    await expect(
      validate(fb2('<FictionBook><body> </body></FictionBook>')),
    ).resolves.toEqual({ noText: true });
  });

  it('limits the extracted text to 1 MB', async () => {
    const big = `<FictionBook><body><p>${'x'.repeat(1024 * 1024 + 1)}</p></body></FictionBook>`;
    await expect(validate(fb2(big))).resolves.toEqual({
      maxTextBytes: { maxBytes: 1024 * 1024, actualBytes: 1024 * 1024 + 1 },
    });
  });
});

describe('bookBaseName', () => {
  it('drops the extension, both parts of .fb2.zip', () => {
    expect(bookBaseName('Emma.fb2.zip')).toBe('Emma');
    expect(bookBaseName('Emma.FB2.ZIP')).toBe('Emma');
    expect(bookBaseName('Mr. Smith.epub')).toBe('Mr. Smith');
    expect(bookBaseName('notes.zip')).toBe('notes');
  });
});

describe('bookTextFile', () => {
  it('turns the ebook into a .txt file', async () => {
    const file = await bookTextFile(fb2(FB2, 'Cat Tales.fb2'));
    expect(file.name).toBe('Cat Tales.txt');
    expect(file.type).toBe('text/plain');
  });
});
