import { MessengerProfile } from "./types";

const CALLOUT_OPENING = /^\s*>\s*\[!([A-Za-z0-9._-]+)\](?:[+-])?(?:\s+.*)?$/;
const CALLOUT_LINE = /^(\s*>\s?)(.*)$/;

export function getCalloutProfileId(text: string): string | null {
  return text.match(CALLOUT_OPENING)?.[1].toLowerCase() ?? null;
}

export function stripCalloutPrefix(text: string): { prefix: string; text: string } | null {
  const match = text.match(CALLOUT_LINE);
  return match ? { prefix: match[1], text: match[2] } : null;
}

export function formatCalloutPaste(text: string, prefix = "> "): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n/g, `\n${prefix}`);
}

export function isLineInsideMessengerCallout(
  getLine: (line: number) => string,
  cursorLine: number,
  profiles: ReadonlyMap<string, MessengerProfile>
): boolean {
  for (let line = cursorLine; line >= 0; line -= 1) {
    const text = getLine(line);
    const appId = getCalloutProfileId(text);
    if (appId) {
      return line < cursorLine && profiles.has(appId);
    }
    if (!stripCalloutPrefix(text)) {
      return false;
    }
  }
  return false;
}
