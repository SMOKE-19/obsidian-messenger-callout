import { App, normalizePath } from "obsidian";
import { parse } from "yaml";
import { isReservedObsidianCalloutId } from "./callout-ids";
import { MessageLineRole, MessengerProfile, MessengerRule } from "./types";

const APP_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ICON_PATH_PATTERN = /^assets\/[A-Za-z0-9._/-]+\.svg$/i;
const LINE_ROLES = new Set<MessageLineRole>(["header", "body", "separator"]);

function isRule(value: unknown): value is MessengerRule {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rule = value as Partial<MessengerRule>;
  return typeof rule.id === "string"
    && typeof rule.pattern === "string"
    && (rule.role === undefined || LINE_ROLES.has(rule.role));
}

function validateProfile(value: unknown, fileName: string): MessengerProfile {
  if (!value || typeof value !== "object") {
    throw new Error(`${fileName}: YAML root must be an object.`);
  }

  const profile = value as Partial<MessengerProfile>;
  if (typeof profile.app_id !== "string" || profile.app_id.trim() === "") {
    throw new Error(`${fileName}: app_id is required.`);
  }
  if (!APP_ID_PATTERN.test(profile.app_id.trim())) {
    throw new Error(
      `${fileName}: app_id may contain only letters, numbers, dots, underscores, and hyphens.`
    );
  }
  if (isReservedObsidianCalloutId(profile.app_id)) {
    throw new Error(
      `${fileName}: app_id "${profile.app_id.trim()}" is reserved by an Obsidian default callout. `
      + `Use a unique id such as "messanger_${profile.app_id.trim().toLowerCase()}".`
    );
  }
  if (!Array.isArray(profile.rules) || !profile.rules.every(isRule)) {
    throw new Error(`${fileName}: rules must be a list of parser rules.`);
  }
  if (profile.appearance !== undefined) {
    if (!profile.appearance || typeof profile.appearance !== "object" ||
        Array.isArray(profile.appearance)) {
      throw new Error(`${fileName}: appearance must be an object.`);
    }
    for (const [name, color] of Object.entries(profile.appearance)) {
      if ((name === "background_color" || name === "title_color" || name === "text_color") &&
          (typeof color !== "string" || !COLOR_PATTERN.test(color))) {
        throw new Error(`${fileName}: appearance colors must use six-digit hex values.`);
      }
    }
    if (profile.appearance.icon !== undefined) {
      const icon = profile.appearance.icon;
      const hasParentSegment = typeof icon === "string" &&
        icon.split("/").some((segment) => segment === "..");
      if (typeof icon !== "string" ||
          (icon !== "messenger-tiles" &&
           (!ICON_PATH_PATTERN.test(icon) || hasParentSegment))) {
        throw new Error(
          `${fileName}: appearance.icon must be an SVG path below assets/.`
        );
      }
    }
  }
  if (profile.senders !== undefined) {
    if (!profile.senders || typeof profile.senders !== "object" || Array.isArray(profile.senders)) {
      throw new Error(`${fileName}: senders must be a sender-to-color object.`);
    }
    for (const [sender, color] of Object.entries(profile.senders)) {
      if (sender.trim() === "" || typeof color !== "string" || !COLOR_PATTERN.test(color)) {
        throw new Error(`${fileName}: sender colors must use six-digit hex values.`);
      }
    }
  }

  return {
    ...profile,
    app_id: profile.app_id.trim(),
    rules: profile.rules
  } as MessengerProfile;
}

export async function loadMessengerProfiles(
  app: App,
  pluginId: string
): Promise<{ profiles: Map<string, MessengerProfile>; errors: string[] }> {
  const profiles = new Map<string, MessengerProfile>();
  const errors: string[] = [];
  const directory = normalizePath(
    `${app.vault.configDir}/plugins/${pluginId}/profiles`
  );

  let files: string[];
  try {
    const listing = await app.vault.adapter.list(directory);
    files = listing.files.filter((file) => /\.ya?ml$/i.test(file));
  } catch {
    return {
      profiles,
      errors: [`Profile directory not found: ${directory}`]
    };
  }

  for (const file of files) {
    try {
      const source = await app.vault.adapter.read(file);
      const profile = validateProfile(parse(source), file);
      const key = profile.app_id.toLowerCase();
      if (profiles.has(key)) {
        throw new Error(`${file}: duplicate app_id "${profile.app_id}".`);
      }
      profiles.set(key, profile);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${file}: unknown error.`);
    }
  }

  return { profiles, errors };
}
