import { MessengerProfile } from "./types";

const DEFAULT_BACKGROUND_COLOR = "#3a3a3a";
const DEFAULT_TITLE_COLOR = "#ffffff";
const DEFAULT_ICON_PATH = "assets/messenger-tiles.svg";

export function buildProfileStyleSheet(
  profiles: ReadonlyMap<string, MessengerProfile>,
  resolveIconUrl: (path: string) => string = (path) => path
): string {
  return [...profiles.values()].map((profile) => {
    const appId = profile.app_id.toLowerCase();
    const background = profile.appearance?.background_color ?? DEFAULT_BACKGROUND_COLOR;
    const title = profile.appearance?.title_color ?? DEFAULT_TITLE_COLOR;
    const configuredIcon = profile.appearance?.icon ?? DEFAULT_ICON_PATH;
    const iconPath = configuredIcon === "messenger-tiles"
      ? DEFAULT_ICON_PATH
      : configuredIcon;
    const iconMask = `url(${JSON.stringify(resolveIconUrl(iconPath))})`;
    const selector = `.callout[data-callout="${appId}"]`;
    const rules = [
      `${selector} {`,
      `  background-color: ${background} !important;`,
      `}`,
      `${selector} > .callout-title {`,
      `  color: ${title} !important;`,
      `}`
    ];
    rules.push(
      `${selector} > .callout-title .callout-icon {`,
      `  color: ${title};`,
      `  height: 1.15em;`,
      `  width: 1.15em;`,
      `}`,
      `${selector} > .callout-title .callout-icon > svg {`,
      `  display: none;`,
      `}`,
      `${selector} > .callout-title .callout-icon::before {`,
      `  background-color: currentColor;`,
      `  content: "";`,
      `  display: block;`,
      `  height: 100%;`,
      `  width: 100%;`,
      `  -webkit-mask-image: ${iconMask};`,
      `  -webkit-mask-position: center;`,
      `  -webkit-mask-repeat: no-repeat;`,
      `  -webkit-mask-size: contain;`,
      `  mask-image: ${iconMask};`,
      `  mask-position: center;`,
      `  mask-repeat: no-repeat;`,
      `  mask-size: contain;`,
      `}`
    );
    return rules.join("\n");
  }).join("\n\n");
}
