import { App, normalizePath } from "obsidian";
import { parse, stringify } from "yaml";
import { MessengerProfile } from "./types";

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const COLOR_PALETTE = [
  "#e06c75",
  "#61afef",
  "#98c379",
  "#c678dd",
  "#e5c07b",
  "#56b6c2",
  "#d19a66",
  "#be5046",
  "#7fdbca",
  "#c8ccd4"
];

interface SenderColorDocument {
  app_id: string;
  senders: Record<string, string>;
}

function parseSenderDocument(source: string, path: string): SenderColorDocument {
  const value = parse(source) as Partial<SenderColorDocument> | null;
  if (!value || typeof value !== "object") {
    throw new Error(`${path}: YAML root must be an object.`);
  }
  if (typeof value.app_id !== "string" || !value.senders || typeof value.senders !== "object") {
    throw new Error(`${path}: app_id and senders are required.`);
  }
  for (const [sender, color] of Object.entries(value.senders)) {
    if (sender.trim() === "" || typeof color !== "string" || !COLOR_PATTERN.test(color)) {
      throw new Error(`${path}: sender colors must use six-digit hex values.`);
    }
  }
  return value as SenderColorDocument;
}

export class SenderRegistry {
  private readonly generated = new Map<string, Map<string, string>>();
  private readonly dirty = new Set<string>();
  private readonly revisions = new Map<string, number>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly directory: string;

  constructor(
    private readonly app: App,
    pluginId: string,
    private readonly reportError: (message: string) => void
  ) {
    this.directory = normalizePath(
      `${app.vault.configDir}/plugins/${pluginId}/profiles/senders`
    );
  }

  async load(profiles: ReadonlyMap<string, MessengerProfile>): Promise<void> {
    if (!(await this.app.vault.adapter.exists(this.directory))) {
      await this.app.vault.adapter.mkdir(this.directory);
    }

    for (const [appId] of profiles) {
      const path = this.pathFor(appId);
      if (!(await this.app.vault.adapter.exists(path))) {
        this.generated.set(appId, new Map());
        continue;
      }
      try {
        const document = parseSenderDocument(
          await this.app.vault.adapter.read(path),
          path
        );
        if (document.app_id.toLowerCase() !== appId) {
          throw new Error(`${path}: app_id must be "${appId}".`);
        }
        this.generated.set(appId, new Map(Object.entries(document.senders)));
      } catch (error) {
        this.generated.set(appId, new Map());
        this.reportError(error instanceof Error ? error.message : `${path}: unknown error.`);
      }
    }
  }

  getColor(profile: MessengerProfile, sender: string): string | undefined {
    const fixed = profile.senders && Object.prototype.hasOwnProperty.call(profile.senders, sender)
      ? profile.senders[sender]
      : undefined;
    return fixed ?? this.generated.get(profile.app_id.toLowerCase())?.get(sender);
  }

  getOrAssignColor(profile: MessengerProfile, sender: string): string {
    const existing = this.getColor(profile, sender);
    if (existing) {
      return existing;
    }

    const appId = profile.app_id.toLowerCase();
    const colors = this.generated.get(appId) ?? new Map<string, string>();
    this.generated.set(appId, colors);
    const used = new Set([
      ...Object.values(profile.senders ?? {}),
      ...colors.values()
    ].map((color) => color.toLowerCase()));
    const color = COLOR_PALETTE.find((candidate) => !used.has(candidate))
      ?? COLOR_PALETTE[this.hash(sender) % COLOR_PALETTE.length];
    colors.set(sender, color);
    this.dirty.add(appId);
    this.revisions.set(appId, (this.revisions.get(appId) ?? 0) + 1);
    this.schedule(appId);
    return color;
  }

  async flush(): Promise<void> {
    await Promise.all([...this.dirty].map((appId) => this.enqueueWrite(appId)));
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    void this.flush();
  }

  private schedule(appId: string): void {
    const previous = this.timers.get(appId);
    if (previous) {
      clearTimeout(previous);
    }
    this.timers.set(appId, setTimeout(() => {
      this.timers.delete(appId);
      void this.enqueueWrite(appId);
    }, 500));
  }

  private enqueueWrite(appId: string): Promise<void> {
    const previous = this.writes.get(appId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.write(appId))
      .catch((error) => {
        this.reportError(
          error instanceof Error ? error.message : `${this.pathFor(appId)}: unknown error.`
        );
      });
    this.writes.set(appId, next);
    return next;
  }

  private async write(appId: string): Promise<void> {
    if (!this.dirty.has(appId)) {
      return;
    }
    const path = this.pathFor(appId);
    const current = this.generated.get(appId) ?? new Map<string, string>();
    const revision = this.revisions.get(appId) ?? 0;

    if (await this.app.vault.adapter.exists(path)) {
      const onDisk = parseSenderDocument(await this.app.vault.adapter.read(path), path);
      if (onDisk.app_id.toLowerCase() !== appId) {
        throw new Error(`${path}: app_id must be "${appId}".`);
      }
      for (const [sender, color] of Object.entries(onDisk.senders)) {
        if (!current.has(sender)) {
          current.set(sender, color);
        }
      }
    }

    const senders = Object.fromEntries(
      [...current.entries()].sort(([left], [right]) => left.localeCompare(right))
    );
    await this.app.vault.adapter.write(
      path,
      stringify({ app_id: appId, senders }, { lineWidth: 0 })
    );
    if ((this.revisions.get(appId) ?? 0) === revision) {
      this.dirty.delete(appId);
    } else {
      this.schedule(appId);
    }
  }

  private pathFor(appId: string): string {
    return normalizePath(`${this.directory}/${appId}.yaml`);
  }

  private hash(value: string): number {
    let hash = 0;
    for (const character of value) {
      hash = ((hash << 5) - hash + character.charCodeAt(0)) >>> 0;
    }
    return hash;
  }
}
