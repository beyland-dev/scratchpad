// Builds separate Apple silicon (arm64) and Intel (x64) DMGs with a branded install window:
// the Sprue icon and an Applications shortcut over resources/dmg/background.tiff.
// electron-builder packages the app (--dir); dmgbuild (Python, `pip install dmgbuild`) makes the
// DMG and writes the window layout directly, so no Finder or GUI session is needed (CI runners
// have neither). scripts/make-dmg.py wraps it to force the final detach.
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("macOS DMGs must be built on macOS");

const root = fileURLToPath(new URL("..", import.meta.url));
const { version, productName } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const release = path.join(root, "release");
const background = path.join(root, "resources/dmg/background.tiff");
const python = process.env.SPRUE_DMG_PYTHON ?? "python3";

/**
 * The background is 660x440pt; the window bounds include the title bar, so the window is that
 * much taller. Icons sit in the background's two empty slots (x 141-248 and 412-535,
 * y 158-268), small enough that their labels fit inside the slots too.
 */
const BACKGROUND = { width: 660, height: 440 };
const TITLE_BAR = 32;
const ICON_SIZE = 72;
const APP_POSITION = [194, 200];
const APPLICATIONS_POSITION = [474, 200];

const archs = (process.env.SPRUE_MAC_ARCHS ?? "arm64,x64").split(",").map((a) => a.trim());

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function buildDmg(arch) {
  const appDir = path.join(release, arch === "x64" ? "mac" : `mac-${arch}`);
  await rm(appDir, { recursive: true, force: true });
  run("pnpm", ["exec", "electron-builder", "--dir", "--mac", `--${arch}`, "--publish", "never"]);

  const app = path.join(appDir, `${productName}.app`);
  const output = path.join(release, `${productName}-${version}-mac-${arch}.dmg`);
  const settings = path.join(release, `dmg-settings-${arch}.py`);
  await rm(output, { force: true });
  // dmgbuild settings are a Python file; values come in as JSON literals.
  const json = JSON.stringify;
  await writeFile(
    settings,
    `format = "UDZO"
compression_level = 9
filesystem = "HFS+"
files = [${json(app)}]
symlinks = {"Applications": "/Applications"}
background = ${json(background)}
window_rect = ((200, 120), (${BACKGROUND.width}, ${BACKGROUND.height + TITLE_BAR}))
default_view = "icon-view"
show_toolbar = False
show_status_bar = False
show_sidebar = False
show_pathbar = False
show_tab_view = False
icon_size = ${ICON_SIZE}
text_size = 13
arrange_by = None
icon_locations = {${json(`${productName}.app`)}: (${APP_POSITION.join(", ")}), "Applications": (${APPLICATIONS_POSITION.join(", ")})}
`,
  );
  run(python, [
    path.join(root, "scripts/make-dmg.py"),
    "-s",
    settings,
    `${productName} ${version}`,
    output,
  ]);
  await rm(settings, { force: true });
  console.log(`Built ${path.relative(root, output)}`);
}

for (const arch of archs) await buildDmg(arch);
