import { z } from 'zod';

/**
 * Schema of an analysis result (brief, section 04). The backend validates its own output too,
 * but the browser never trusts the network: every result is parsed with this schema before it
 * is displayed, saved in the history or exported.
 */

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day written as YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isoDate = z.string().refine(isIsoDate, { message: 'Oczekiwano daty w formacie RRRR-MM-DD' });
const text = z.string().trim().min(1);
const textList = z.array(text);

export const documentSchema = z.object({
  fileName: z.string().min(1),
  pages: z.number().int().min(1),
  language: z
    .string()
    .regex(/^[a-z]{2}$/, 'Oczekiwano kodu języka ISO 639-1')
    .nullable(),
  type: z.enum(DOCUMENT_TYPES),
  title: text.nullable(),
  date: isoDate.nullable(),
});

export const amountSchema = z.object({
  value: z.number(), // Zod 4 rejects Infinity and NaN by default
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Oczekiwano kodu waluty ISO 4217')
    .nullable(),
  context: text.nullable(),
});

export const dateItemSchema = z.object({
  date: isoDate,
  context: text.nullable(),
});

/** Extra information added by this implementation (the brief allows additional fields). */
export const metaSchema = z.object({
  model: z.string(),
  chunks: z.number().int().min(1),
  ocrPages: z.array(z.number().int().min(1)),
  truncated: z.boolean(),
  warnings: z.array(z.string()),
  processingMs: z.number().int().min(0),
});

export const analysisResultSchema = z.object({
  document: documentSchema,
  summary: text,
  keyPoints: textList.min(3).max(7),
  entities: z.object({
    organizations: textList,
    people: textList,
  }),
  amounts: z.array(amountSchema),
  dates: z.array(dateItemSchema),
  keywords: textList,
  meta: metaSchema.optional(),
});

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentInfo = z.infer<typeof documentSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type DateItem = z.infer<typeof dateItemSchema>;
export type AnalysisMeta = z.infer<typeof metaSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export type ParseOutcome =
  { success: true; data: AnalysisResult } | { success: false; issues: string[] };

/** Validates unknown data (e.g. an API response) against the result schema. */
export function parseAnalysisResult(data: unknown): ParseOutcome {
  const parsed = analysisResultSchema.safeParse(data);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  };
}
