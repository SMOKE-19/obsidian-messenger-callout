import { Prec, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate
} from "@codemirror/view";
import {
  formatCalloutPaste,
  getCalloutProfileId,
  isLineInsideMessengerCallout,
  stripCalloutPrefix
} from "./callout";
import { parseMessengerTranscript } from "./parser";
import { MessengerProfile, ParsedLine } from "./types";

interface CalloutSourceLine {
  text: string;
  from: number;
  to: number;
}

interface DecorationRange {
  from: number;
  to: number;
  decoration: Decoration;
}

function safeClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function createMessengerCalloutEditorExtension(
  getProfiles: () => ReadonlyMap<string, MessengerProfile>,
  resolveSenderColor: (
    profile: MessengerProfile,
    sender: string
  ) => string | undefined
) {
  const pasteHandler = Prec.highest(EditorView.domEventHandlers({
    paste(event, view): boolean {
      if (event.defaultPrevented || !event.clipboardData) {
        return false;
      }
      if (Array.from(event.clipboardData.items).some((item) => item.type.startsWith("image/"))) {
        return false;
      }

      const text = event.clipboardData.getData("text/plain");
      if (!text.includes("\n") && !text.includes("\r")) {
        return false;
      }

      const currentLine = view.state.doc.lineAt(view.state.selection.main.head);
      const cursorLine = currentLine.number - 1;
      if (!isLineInsideMessengerCallout(
        (line) => view.state.doc.line(line + 1).text,
        cursorLine,
        getProfiles()
      )) {
        return false;
      }

      const prefix = stripCalloutPrefix(currentLine.text)?.prefix ?? "> ";
      event.preventDefault();
      view.dispatch(view.state.replaceSelection(formatCalloutPaste(text, prefix)));
      return true;
    }
  }));

  const decorations = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      private build(view: EditorView): DecorationSet {
        const ranges: DecorationRange[] = [];
        const profiles = getProfiles();
        let number = 1;

        while (number <= view.state.doc.lines) {
          const opening = view.state.doc.line(number);
          const appId = getCalloutProfileId(opening.text);
          const profile = appId ? profiles.get(appId) : undefined;
          if (!profile) {
            number += 1;
            continue;
          }

          const sourceLines: CalloutSourceLine[] = [];
          number += 1;
          while (number <= view.state.doc.lines) {
            const line = view.state.doc.line(number);
            const stripped = stripCalloutPrefix(line.text);
            if (!stripped) {
              break;
            }
            const from = line.from + stripped.prefix.length;
            sourceLines.push({
              text: stripped.text,
              from,
              to: from + stripped.text.length
            });
            number += 1;
          }
          this.addCalloutRanges(ranges, sourceLines, profile);
        }

        const builder = new RangeSetBuilder<Decoration>();
        ranges
          .filter((range) => range.to > range.from)
          .sort((left, right) => left.from - right.from || left.to - right.to)
          .forEach((range) => builder.add(range.from, range.to, range.decoration));
        return builder.finish();
      }

      private addCalloutRanges(
        ranges: DecorationRange[],
        sourceLines: CalloutSourceLine[],
        profile: MessengerProfile
      ): void {
        if (sourceLines.length === 0) {
          return;
        }
        const transcript = parseMessengerTranscript(
          sourceLines.map((line) => line.text).join("\n"),
          profile,
          (sender) => resolveSenderColor(profile, sender)
        );
        const senderColors = new Map<ParsedLine, string>();
        for (const message of transcript.messages) {
          if (!message.sender) {
            continue;
          }
          const color = resolveSenderColor(profile, message.sender);
          if (!color) {
            continue;
          }
          senderColors.set(message.header, color);
          message.body.forEach((line) => senderColors.set(line, color));
        }

        transcript.lines.forEach((line, index) => {
          const source = sourceLines[index];
          if (!source) {
            return;
          }
          const lineAttributes: Record<string, string> = {};
          if (line.message) {
            lineAttributes.title = line.message;
          }
          const senderColor = senderColors.get(line);
          if (senderColor) {
            lineAttributes.style = `--messenger-sender-color: ${senderColor}`;
          }
          ranges.push({
            from: source.from,
            to: source.to,
            decoration: Decoration.mark({
              class: [
                `messenger-line-${safeClass(line.style)}`,
                line.lint !== "none" ? `messenger-lint-${line.lint}` : ""
              ].filter(Boolean).join(" "),
              attributes: lineAttributes
            })
          });
          for (const span of line.spans) {
            const attributes: Record<string, string> = {};
            if (span.color) {
              attributes.style = `--messenger-sender-color: ${span.color}`;
            }
            ranges.push({
              from: source.from + span.from,
              to: source.from + span.to,
              decoration: Decoration.mark({
                class: `messenger-token-${safeClass(span.style)}`,
                attributes
              })
            });
          }
        });
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

  return [pasteHandler, decorations];
}
