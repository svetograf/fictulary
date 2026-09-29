import { FileValidator } from '@nestjs/common';

/**
 * Accepts `.txt` files whose content looks like text. Plain text has no magic
 * number, so the built-in FileTypeValidator can't be used here; instead we
 * check the extension and reject content containing NUL bytes (binary data).
 */
export class TextFileValidator extends FileValidator {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    return (
      !!file && /\.txt$/i.test(file.originalname) && !file.buffer.includes(0)
    );
  }

  buildErrorMessage(): string {
    return 'File must be a plain text (.txt) file';
  }
}
