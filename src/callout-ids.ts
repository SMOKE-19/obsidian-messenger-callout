export const OBSIDIAN_DEFAULT_CALLOUT_IDS = new Set([
  "note",
  "abstract",
  "summary",
  "tldr",
  "info",
  "todo",
  "tip",
  "hint",
  "important",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "warning",
  "caution",
  "attention",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite"
]);

export function isReservedObsidianCalloutId(appId: string): boolean {
  return OBSIDIAN_DEFAULT_CALLOUT_IDS.has(appId.trim().toLowerCase());
}
