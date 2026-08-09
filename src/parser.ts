import {
  MessengerProfile,
  MessengerRule,
  ParsedLine,
  ParsedMessage,
  ParsedSpan,
  ParsedTranscript
} from "./types";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const source = pattern
    .split("*")
    .map((part) => part.split("?").map(escapeRegex).join("."))
    .join(".*");
  return new RegExp(`^${source}$`);
}

function compileRule(rule: MessengerRule): RegExp {
  if ((rule.match ?? "regex") === "glob") {
    return globToRegex(rule.pattern);
  }
  const flags = (rule.flags ?? "").replace(/[gy]/g, "");
  return new RegExp(rule.pattern, flags);
}

function captureSpans(
  text: string,
  match: RegExpExecArray,
  captures: Record<string, string> | undefined,
  resolveSenderColor?: (sender: string) => string | undefined
): ParsedSpan[] {
  if (!captures || !match.groups) {
    return [];
  }

  const spans: ParsedSpan[] = [];
  let searchFrom = 0;
  for (const [groupName, style] of Object.entries(captures)) {
    const value = match.groups[groupName];
    if (!value) {
      continue;
    }
    let from = text.indexOf(value, searchFrom);
    if (from < 0) {
      from = text.indexOf(value);
    }
    if (from >= 0) {
      spans.push({
        from,
        to: from + value.length,
        style,
        capture: groupName,
        value,
        color: groupName === "sender" ? resolveSenderColor?.(value) : undefined
      });
      searchFrom = from + value.length;
    }
  }
  return spans.sort((a, b) => a.from - b.from || a.to - b.to);
}

function parseLine(
  text: string,
  from: number,
  profile: MessengerProfile,
  resolveSenderColor?: (sender: string) => string | undefined
): ParsedLine {
  for (const rule of profile.rules) {
    let regex: RegExp;
    try {
      regex = compileRule(rule);
    } catch (error) {
      return {
        text,
        from,
        to: from + text.length,
        ruleId: rule.id,
        role: rule.role ?? null,
        style: "invalid-rule",
        spans: [],
        lint: "error",
        message: error instanceof Error ? error.message : "Invalid parser rule."
      };
    }

    const match = regex.exec(text);
    if (match) {
      return {
        text,
        from,
        to: from + text.length,
        ruleId: rule.id,
        role: rule.role ?? null,
        style: rule.style ?? rule.id,
        spans: captureSpans(text, match, rule.captures, resolveSenderColor),
        lint: rule.lint ?? "none",
        message: rule.message ?? null
      };
    }
  }

  return {
    text,
    from,
    to: from + text.length,
    ruleId: null,
    role: null,
    style: profile.fallback?.style ?? "unknown",
    spans: [],
    lint: profile.fallback?.lint ?? "warning",
    message: profile.fallback?.message ?? "No parser rule matched this line."
  };
}

function senderFromHeader(line: ParsedLine): string | null {
  return line.spans.find((span) => span.capture === "sender")?.value ?? null;
}

function withWarning(line: ParsedLine, message: string): ParsedLine {
  if (line.lint === "error") {
    return line;
  }
  return {
    ...line,
    lint: "warning",
    message: line.message ? `${line.message} ${message}` : message
  };
}

export function parseMessengerTranscript(
  source: string,
  profile: MessengerProfile,
  resolveSenderColor?: (sender: string) => string | undefined
): ParsedTranscript {
  const lines = source.split("\n");
  let offset = 0;
  const parsedLines: ParsedLine[] = [];
  const messages: ParsedMessage[] = [];
  const senders = new Set<string>();
  let currentMessage: ParsedMessage | null = null;
  let previousSender: string | null = null;
  for (const line of lines) {
    const lineFrom = offset;
    offset += line.length + 1;
    let parsed = parseLine(line, lineFrom, profile, resolveSenderColor);
    for (const span of parsed.spans) {
      if (span.capture === "sender") {
        senders.add(span.value);
      }
    }

    if (parsed.role === "header") {
      if (currentMessage) {
        parsed = withWarning(
          parsed,
          "The previous message was not terminated by a blank line."
        );
      }
      const sender = senderFromHeader(parsed);
      currentMessage = {
        header: parsed,
        body: [],
        separator: null,
        sender,
        sameSenderAsPrevious: sender !== null && sender === previousSender
      };
      messages.push(currentMessage);
      previousSender = sender;
    } else if (parsed.role === "body") {
      if (currentMessage) {
        currentMessage.body.push(parsed);
      } else {
        parsed = withWarning(parsed, "Message body found before a message header.");
      }
    } else if (parsed.role === "separator" && currentMessage) {
      currentMessage.separator = parsed;
      currentMessage = null;
    }
    parsedLines.push(parsed);
  }

  return {
    appId: profile.app_id,
    profile,
    lines: parsedLines,
    messages,
    senders: [...senders]
  };
}
