export type MatchKind = "regex" | "glob";
export type LintLevel = "none" | "warning" | "error";
export type MessageLineRole = "header" | "body" | "separator";

export interface MessengerRule {
  id: string;
  match?: MatchKind;
  pattern: string;
  flags?: string;
  role?: MessageLineRole;
  style?: string;
  captures?: Record<string, string>;
  lint?: LintLevel;
  message?: string;
}

export interface MessengerFallback {
  style?: string;
  lint?: LintLevel;
  message?: string;
}

export interface MessengerAppearance {
  background_color?: string;
  title_color?: string;
  icon?: string;
  /** Deprecated and ignored. Kept so older profile files continue to load. */
  text_color?: string;
}

export interface MessengerProfile {
  app_id: string;
  display_name?: string;
  appearance?: MessengerAppearance;
  senders?: Record<string, string>;
  rules: MessengerRule[];
  fallback?: MessengerFallback;
}

export interface ParsedSpan {
  from: number;
  to: number;
  style: string;
  capture: string;
  value: string;
  color?: string;
}

export interface ParsedLine {
  text: string;
  from: number;
  to: number;
  ruleId: string | null;
  role: MessageLineRole | null;
  style: string;
  spans: ParsedSpan[];
  lint: LintLevel;
  message: string | null;
}

export interface ParsedMessage {
  header: ParsedLine;
  body: ParsedLine[];
  separator: ParsedLine | null;
  sender: string | null;
  sameSenderAsPrevious: boolean;
}

export interface ParsedTranscript {
  appId: string;
  profile: MessengerProfile;
  lines: ParsedLine[];
  messages: ParsedMessage[];
  senders: string[];
}
