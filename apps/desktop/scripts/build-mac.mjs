// Builds separate Apple silicon (arm64) and Intel (x64) DMGs with a branded install window:
// the Sprue icon and an Applications shortcut over resources/dmg/background.tiff.
// electron-builder packages the apps (--dir); hdiutil and Finder make the DMGs, which avoids
// electron-builder's flaky DMG step ("Resource busy") on CI.
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("macOS DMGs must be built on macOS");

const root = fileURLToPath(new URL("..", import.meta.url));
const { version, productName } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const release = path.join(root, "release");
const background = path.join(root, "resources/dmg/background.tiff");

/** Window size and icon positions (points), matching the background's two empty slots. */
const WINDOW = { width: 660, height: 440 };
const ICON_SIZE = 88;
const APP_POSITION = { x: 194, y: 212 };
const APPLICATIONS_POSITION = { x: 474, y: 212 };

const archs = (process.env.SPRUE_MAC_ARCHS ?? "arm64,x64").split(",");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
  return result;
}

/** hdiutil sometimes reports "Resource busy" right after Finder touches a volume; retry. */
function hdiutil(args) {
  for (let attempt = 1; ; attempt++) {
    const result = spawnSync("hdiutil", args, { cwd: root, encoding: "utf8" });
    if (result.status === 0) return result.stdout;
    if (attempt >= 5 || !/busy/i.test(result.stderr)) {
      process.stderr.write(result.stderr);
      throw new Error(`hdiutil ${args[0]} failed`);
    }
    spawnSync("sleep", [String(attempt * 2)]);
  }
}

/** Arrange the mounted volume's window. Finder needs a few seconds to write .DS_Store. */
function layOutWindow(volumeName) {
  const left = 200;
  const top = 120;
  const script = `
tell application "Finder"
  tell disk "${volumeName}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {${left}, ${top}, ${left + WINDOW.width}, ${top + WINDOW.height}}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to ${ICON_SIZE}
    set text size of viewOptions to 13
    set background picture of viewOptions to file ".background:background.tiff"
    set position of item "${productName}.app" of container window to {${APP_POSITION.x}, ${APP_POSITION.y}}
    set position of item "Applications" of container window to {${APPLICATIONS_POSITION.x}, ${APPLICATIONS_POSITION.y}}
    update without registering applications
    delay 3
    close
  end tell
end tell`;
  run("osascript", ["-e", script]);
}

async function buildDmg(arch) {
  const appDir = path.join(release, arch === "x64" ? "mac" : `mac-${arch}`);
  await rm(appDir, { recursive: true, force: true });
  run("pnpm", ["exec", "electron-builder", "--dir", "--mac", `--${arch}`, "--publish", "never"]);

  const volumeName = `${productName} ${version}`;
  const staging = path.join(release, `dmg-${arch}`);
  const writable = path.join(release, `${productName}-${arch}-rw.dmg`);
  const output = path.join(release, `${productName}-${version}-mac-${arch}.dmg`);
  await Promise.all(
    [staging, writable, output].map((p) => rm(p, { recursive: true, force: true })),
  );

  await mkdir(path.join(staging, ".background"), { recursive: true });
  await cp(path.join(appDir, `${productName}.app`), path.join(staging, `${productName}.app`), {
    recursive: true,
    verbatimSymlinks: true,
  });
  await symlink("/Applications", path.join(staging, "Applications"));
  await cp(background, path.join(staging, ".background/background.tiff"));

  // Detach a stale mount with the same name from an earlier failed run.
  spawnSync("hdiutil", ["detach", `/Volumes/${volumeName}`, "-force"], { stdio: "ignore" });
  hdiutil([
    "create",
    "-volname",
    volumeName,
    "-srcfolder",
    staging,
    "-fs",
    "HFS+",
    "-format",
    "UDRW",
    "-ov",
    writable,
  ]);
  const attached = hdiutil(["attach", "-readwrite", "-noverify", "-noautoopen", writable]);
  const device = /^(\/dev\/disk\d+)/m.exec(attached)?.[1];
  try {
    layOutWindow(volumeName);
    spawnSync("sync");
  } finally {
    hdiutil(["detach", device ?? `/Volumes/${volumeName}`]);
  }
  hdiutil(["convert", writable, "-format", "UDZO", "-imagekey", "zlib-level=9", "-o", output]);
  await Promise.all([staging, writable].map((p) => rm(p, { recursive: true, force: true })));
  console.log(`Built ${path.relative(root, output)}`);
}

for (const arch of archs) await buildDmg(arch.trim());
