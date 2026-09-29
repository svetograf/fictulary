import { TextFileValidator } from './text-file.validator';

const file = (originalname: string, content: Buffer) =>
  ({ originalname, buffer: content }) as Express.Multer.File;

describe('TextFileValidator', () => {
  const validator = new TextFileValidator();

  it('accepts .txt files with text content', () => {
    expect(validator.isValid(file('Book.TXT', Buffer.from('hello')))).toBe(
      true,
    );
  });

  it('rejects other extensions', () => {
    expect(validator.isValid(file('book.pdf', Buffer.from('hello')))).toBe(
      false,
    );
  });

  it('rejects binary content', () => {
    expect(validator.isValid(file('book.txt', Buffer.from([0x68, 0x00])))).toBe(
      false,
    );
  });

  it('rejects a missing file', () => {
    expect(validator.isValid(undefined)).toBe(false);
  });
});
