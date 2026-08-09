import { App, normalizePath } from "obsidian";
import exampleProfile from "../profiles/example.yaml";

const DEFAULT_PROFILES: Record<string, string> = {
  "example.yaml": exampleProfile
};

export async function ensureDefaultProfiles(
  app: App,
  pluginId: string
): Promise<void> {
  const directory = normalizePath(
    `${app.vault.configDir}/plugins/${pluginId}/profiles`
  );

  if (!(await app.vault.adapter.exists(directory))) {
    await app.vault.adapter.mkdir(directory);
  }

  for (const [fileName, source] of Object.entries(DEFAULT_PROFILES)) {
    const path = normalizePath(`${directory}/${fileName}`);
    if (!(await app.vault.adapter.exists(path))) {
      await app.vault.adapter.write(path, source);
    }
  }
}
