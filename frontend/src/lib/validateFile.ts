export const MAX_FILE_MB = 10;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export type FileCheck = { ok: true } | { ok: false; message: string };

function looksLikePdfName(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Quick checks that need no file content: type, extension and size. */
export function checkFileBasics(file: File): FileCheck {
  if (!looksLikePdfName(file)) {
    return { ok: false, message: 'To nie jest plik PDF. Wybierz plik z rozszerzeniem .pdf.' };
  }
  if (file.size === 0) {
    return { ok: false, message: 'Plik jest pusty.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `Plik jest za duży (${formatSize(file.size)}). Maksymalny rozmiar to ${MAX_FILE_MB} MB.`,
    };
  }
  return { ok: true };
}

/** Full check: the basics plus the "%PDF-" signature, so a renamed file is caught early. */
export async function checkFile(file: File): Promise<FileCheck> {
  const basics = checkFileBasics(file);
  if (!basics.ok) return basics;

  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const signature = new TextDecoder('latin1').decode(head);
  if (!signature.includes('%PDF-')) {
    return {
      ok: false,
      message: 'Plik ma rozszerzenie .pdf, ale nie jest poprawnym dokumentem PDF.',
    };
  }
  return { ok: true };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
