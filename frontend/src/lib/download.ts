import type { AnalysisResult } from './schema';

/** "Umowa 14/2026.pdf" → "Umowa 14-2026.json" */
export function jsonFileName(pdfName: string): string {
  const base = pdfName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim();
  return `${base || 'analiza'}.json`;
}

export function resultToJson(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

/** Saves the result as a .json file in the browser. */
export function downloadResult(result: AnalysisResult): void {
  const blob = new Blob([resultToJson(result)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = jsonFileName(result.document.fileName);
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL is revoked.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
