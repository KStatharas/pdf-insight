export const MAX_FILE_MB = 10;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export type FileProblem = 'notPdf' | 'empty' | 'tooLarge' | 'badSignature';

/** The result of a file check; the interface turns `problem` into a message in its language. */
export type FileCheck = { ok: true } | { ok: false; problem: FileProblem; size: number };

function looksLikePdfName(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Quick checks that need no file content: type, extension and size. */
export function checkFileBasics(file: File): FileCheck {
  if (!looksLikePdfName(file)) return { ok: false, problem: 'notPdf', size: file.size };
  if (file.size === 0) return { ok: false, problem: 'empty', size: 0 };
  if (file.size > MAX_FILE_BYTES) return { ok: false, problem: 'tooLarge', size: file.size };
  return { ok: true };
}

/** Full check: the basics plus the "%PDF-" signature, so a renamed file is caught early. */
export async function checkFile(file: File): Promise<FileCheck> {
  const basics = checkFileBasics(file);
  if (!basics.ok) return basics;

  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const signature = new TextDecoder('latin1').decode(head);
  if (!signature.includes('%PDF-')) {
    return { ok: false, problem: 'badSignature', size: file.size };
  }
  return { ok: true };
}
