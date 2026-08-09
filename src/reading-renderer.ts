import { parseMessengerTranscript } from "./parser";
import { MessengerProfile, ParsedLine } from "./types";

function safeClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function parseReadingTextNodes(
  texts: readonly string[],
  profile: MessengerProfile,
  resolveSenderColor?: (sender: string) => string | undefined
): ReturnType<typeof parseMessengerTranscript> {
  return parseMessengerTranscript(
    texts
      .flatMap((text) => text.split("\n"))
      .filter((text) => text.trim() !== "")
      .join("\n"),
    profile,
    resolveSenderColor
  );
}

function senderColorsByLine(
  transcript: ReturnType<typeof parseMessengerTranscript>,
  profile: MessengerProfile,
  resolveSenderColor: (profile: MessengerProfile, sender: string) => string | undefined
): Map<ParsedLine, string> {
  const colors = new Map<ParsedLine, string>();
  for (const message of transcript.messages) {
    if (!message.sender) {
      continue;
    }
    const color = resolveSenderColor(profile, message.sender);
    if (!color) {
      continue;
    }
    colors.set(message.header, color);
    message.body.forEach((line) => colors.set(line, color));
  }
  return colors;
}

function decorateContent(
  container: HTMLElement,
  profile: MessengerProfile,
  resolveSenderColor: (profile: MessengerProfile, sender: string) => string | undefined
): void {
  const oldDecorations = Array.from(container.querySelectorAll<HTMLElement>(
    '.messenger-line, [class^="messenger-token-"], [class*=" messenger-token-"]'
  ));
  oldDecorations.reverse().forEach((element) => {
    element.replaceWith(...Array.from(element.childNodes));
  });
  container.normalize();

  const document = container.ownerDocument;
  const walker = document.createTreeWalker(container, 4);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const parent = current.parentElement;
    if (parent && current.nodeValue?.trim() &&
        !parent.closest(".internal-embed, script, style")) {
      nodes.push(current as Text);
    }
  }

  const transcript = parseReadingTextNodes(
    nodes.map((node) => node.data),
    profile,
    (sender) => resolveSenderColor(profile, sender)
  );
  const colors = senderColorsByLine(transcript, profile, resolveSenderColor);
  let pieceIndex = 0;

  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    const pieces = node.data.split("\n");
    pieces.forEach((text, index) => {
      const line = text.trim() === "" ? undefined : transcript.lines[pieceIndex++];
      if (!line || (line.role !== "header" && line.role !== "body")) {
        fragment.append(text);
      } else {
        const lineElement = document.createElement("span");
        lineElement.className = `messenger-line messenger-line-${safeClass(line.style)}`;
        const color = colors.get(line);
        if (color) {
          lineElement.style.setProperty("--messenger-sender-color", color);
        }

        let offset = 0;
        for (const span of line.spans) {
          lineElement.append(text.slice(offset, span.from));
          const token = document.createElement("span");
          token.className = `messenger-token-${safeClass(span.style)}`;
          token.textContent = text.slice(span.from, span.to);
          lineElement.append(token);
          offset = span.to;
        }
        lineElement.append(text.slice(offset));
        fragment.append(lineElement);
      }
      if (index < pieces.length - 1) {
        fragment.append("\n");
      }
    });
    node.replaceWith(fragment);
  }
}

export function processMessengerCallouts(
  root: HTMLElement,
  profiles: ReadonlyMap<string, MessengerProfile>,
  resolveSenderColor: (profile: MessengerProfile, sender: string) => string | undefined
): void {
  const callouts = new Set<HTMLElement>();
  if (root.matches(".callout[data-callout]")) {
    callouts.add(root);
  }
  root.querySelectorAll<HTMLElement>(".callout[data-callout]").forEach((callout) => {
    callouts.add(callout);
  });

  for (const callout of callouts) {
    const appId = callout.dataset.callout?.toLowerCase();
    const profile = appId ? profiles.get(appId) : undefined;
    const content = callout.querySelector<HTMLElement>(":scope > .callout-content");
    if (profile && content) {
      decorateContent(content, profile, resolveSenderColor);
    }
  }
}
