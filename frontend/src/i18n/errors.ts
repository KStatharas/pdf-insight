import type { ApiError } from '../api/client';
import type { FileCheck } from '../lib/validateFile';
import { MAX_FILE_MB } from '../lib/validateFile';
import { formatSize } from '../lib/format';
import type { Language, Messages } from './messages';

/**
 * The server writes its error messages in Polish, sometimes with details (e.g. the page limit),
 * so the Polish interface shows them as they are; other languages use their own text per code.
 */
export function apiErrorMessage(error: ApiError, t: Messages, language: Language): string {
  if (language === 'pl' && error.serverMessage) return error.serverMessage;
  return t.apiErrors[error.code];
}

export function fileCheckMessage(check: FileCheck, t: Messages, locale: string): string | null {
  if (check.ok) return null;
  switch (check.problem) {
    case 'notPdf':
      return t.fileErrors.notPdf;
    case 'empty':
      return t.fileErrors.empty;
    case 'tooLarge':
      return t.fileErrors.tooLarge(formatSize(check.size, locale), MAX_FILE_MB);
    case 'badSignature':
      return t.fileErrors.badSignature;
  }
}
