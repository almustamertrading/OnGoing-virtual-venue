// Pure helpers for document intelligence: page-numbered text for AI prompts, and checks that an AI-quoted
// excerpt really appears on the page it cites (so every finding's source can be trusted or flagged).

/** Lower case, no diacritics or tatweel, unified Arabic letter forms, punctuation and spaces collapsed. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[آأإ]/g, "ا") // آ أ إ → ا
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ى/g, "ي") // ى → ي
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Excerpts shorter than this (after normalisation) are too generic to prove anything. */
export const MIN_EXCERPT_CHARS = 10;

export type ExcerptCheck = { verified: boolean; page: number | null; corrected: boolean };

/**
 * Where an excerpt appears. Checks the cited page first, then every other page (the model may cite the
 * wrong page). Not found anywhere, or too short to be meaningful: not verified.
 */
export function locateExcerpt(pages: readonly string[], citedPage: number | null, excerpt: string): ExcerptCheck {
  const needle = normalizeForMatch(excerpt);
  const valid = citedPage !== null && Number.isInteger(citedPage) && citedPage >= 1 && citedPage <= pages.length ? citedPage : null;
  if (needle.length < MIN_EXCERPT_CHARS) return { verified: false, page: valid, corrected: false };
  if (valid !== null && normalizeForMatch(pages[valid - 1]).includes(needle)) return { verified: true, page: valid, corrected: false };
  for (let i = 0; i < pages.length; i++) {
    if (normalizeForMatch(pages[i]).includes(needle)) return { verified: true, page: i + 1, corrected: valid !== i + 1 };
  }
  return { verified: false, page: valid, corrected: false };
}

export type PagedText = { text: string; includedPages: number; totalPages: number; truncated: boolean };

/**
 * Joins pages with explicit markers so the model can cite page numbers: "[[page N]]". Whole pages are kept
 * until the character budget is reached; the caller is told when later pages were left out.
 */
export function pagedText(pages: readonly string[], maxChars: number): PagedText {
  const parts: string[] = [];
  let used = 0;
  let included = 0;
  for (let i = 0; i < pages.length; i++) {
    const block = `[[page ${i + 1}]]\n${pages[i].trim()}\n`;
    if (used + block.length > maxChars && included > 0) break;
    parts.push(block.length > maxChars ? block.slice(0, maxChars) : block);
    used += block.length;
    included++;
  }
  return { text: parts.join("\n"), includedPages: included, totalPages: pages.length, truncated: included < pages.length };
}

/** Splits page text into sentence-like pieces (used by the mock provider and for previews). */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟。])\s+|\n+/u)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12);
}

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
/** The numbers written in a text, normalised (Arabic-Indic digits, thousands separators, leading zeros). */
export function extractNumbers(text: string): string[] {
  const western = text
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/(\d)[,\u066C](?=\d{3}\b)/g, "$1")
    .replace(/(\d)\u066B(\d)/g, "$1.$2");
  return [...new Set((western.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))))];
}
