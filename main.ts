import { normalizePath, Notice, Plugin } from "obsidian";
import { ensureDefaultProfiles } from "./src/default-profiles";
import { createMessengerCalloutEditorExtension } from "./src/editor";
import { loadMessengerProfiles } from "./src/profile-loader";
import { buildProfileStyleSheet } from "./src/profile-styles";
import { processMessengerCallouts } from "./src/reading-renderer";
import { SenderRegistry } from "./src/sender-registry";
import { MessengerProfile } from "./src/types";

export default class MessengerCalloutPlugin extends Plugin {
  private profiles = new Map<string, MessengerProfile>();
  private senderRegistry: SenderRegistry | null = null;

  async onload(): Promise<void> {
    await ensureDefaultProfiles(this.app, this.manifest.id);
    const loaded = await loadMessengerProfiles(this.app, this.manifest.id);
    this.profiles = loaded.profiles;
    this.senderRegistry = new SenderRegistry(
      this.app,
      this.manifest.id,
      (message) => {
        console.warn("Messenger Callout sender registry error", message);
        new Notice(`Messenger Callout: sender 색상 파일을 저장하지 못했습니다. ${message}`);
      }
    );
    await this.senderRegistry.load(this.profiles);

    if (loaded.errors.length > 0) {
      console.warn("Messenger Callout profile errors", loaded.errors);
      new Notice(
        `Messenger Callout: ${loaded.errors.length}개 YAML 프로필을 읽지 못했습니다.`
      );
    }

    const profileStyles = document.createElement("style");
    profileStyles.dataset.messengerProfileStyles = "true";
    const pluginDirectory = normalizePath(
      `${this.app.vault.configDir}/plugins/${this.manifest.id}`
    );
    profileStyles.textContent = buildProfileStyleSheet(
      this.profiles,
      (path) => this.app.vault.adapter.getResourcePath(
        normalizePath(`${pluginDirectory}/${path}`)
      )
    );
    document.head.append(profileStyles);
    this.register(() => profileStyles.remove());

    this.registerMarkdownPostProcessor((element) => {
      processMessengerCallouts(
        element,
        this.profiles,
        (profile, sender) => this.senderRegistry?.getOrAssignColor(profile, sender)
      );
    });

    this.registerEditorExtension(
      createMessengerCalloutEditorExtension(
        () => this.profiles,
        (profile, sender) => this.senderRegistry?.getOrAssignColor(profile, sender)
      )
    );
  }

  onunload(): void {
    this.senderRegistry?.dispose();
  }
}
