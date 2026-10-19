import { describe, expect, it } from 'vitest';

import { checkFile, checkFileBasics, formatSize, MAX_FILE_BYTES } from './validateFile';

function file(content: BlobPart[], name: string, type = 'application/pdf'): File {
  return new File(content, name, { type });
}

/** A file whose reported size is `size` without allocating that much memory. */
function sizedFile(name: string, size: number): File {
  const f = file(['%PDF-1.4'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('checkFileBasics', () => {
  it('accepts a PDF under the limit', () => {
    expect(checkFileBasics(file(['%PDF-1.4'], 'umowa.pdf'))).toEqual({ ok: true });
  });

  it('accepts a .pdf file without a MIME type', () => {
    expect(checkFileBasics(file(['%PDF-1.4'], 'UMOWA.PDF', '')).ok).toBe(true);
  });

  it('rejects other file types', () => {
    const check = checkFileBasics(file(['hello'], 'notatki.docx', 'application/msword'));
    expect(check.ok).toBe(false);
    expect(check.ok ? '' : check.message).toContain('nie jest plik PDF');
  });

  it('rejects empty files', () => {
    expect(checkFileBasics(file([], 'pusty.pdf')).ok).toBe(false);
  });

  it('accepts exactly 10 MB and rejects anything larger', () => {
    expect(checkFileBasics(sizedFile('a.pdf', MAX_FILE_BYTES)).ok).toBe(true);
    const tooBig = checkFileBasics(sizedFile('b.pdf', MAX_FILE_BYTES + 1));
    expect(tooBig.ok).toBe(false);
    expect(tooBig.ok ? '' : tooBig.message).toContain('10 MB');
  });
});

describe('checkFile', () => {
  it('accepts a file with the PDF signature', async () => {
    await expect(checkFile(file(['%PDF-1.7\n...'], 'a.pdf'))).resolves.toEqual({ ok: true });
  });

  it('rejects a renamed file without the PDF signature', async () => {
    const check = await checkFile(file(['PK\u0003\u0004 zip'], 'archiwum.pdf'));
    expect(check.ok).toBe(false);
  });
});

describe('formatSize', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [568912, '556 KB'],
    [5 * 1024 * 1024, '5,0 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });
});
