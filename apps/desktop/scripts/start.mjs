// Launch the desktop app from source. On macOS the Dock and menu bar show the running bundle's
// name and icon, so dev runs use a cached copy of Electron.app renamed to "Sprue".
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronBinary from "electron";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const args = [path.join(desktopRoot, "dist/main.mjs"), ...process.argv.slice(2)];

async function devBundle() {
  const source = electronBinary.slice(0, electronBinary.indexOf(".app/") + 4);
  const icon = path.join(desktopRoot, "resources/app-icon-macos.png");
  const stamp = createHash("sha256")
    .update(source)
    .update(await readFile(icon))
    .digest("hex");
  const target = path.join(desktopRoot, ".dev/Sprue.app");
  const stampFile = path.join(desktopRoot, ".dev/stamp");
  const binary = path.join(target, "Contents/MacOS/Electron");
  if (existsSync(binary) && (await readFile(stampFile, "utf8").catch(() => "")) === stamp)
    return binary;

  console.log("Preparing .dev/Sprue.app…");
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  // Keep the frameworks' symlinks as they are; resolving them breaks the bundle.
  await cp(source, target, { recursive: true, verbatimSymlinks: true });

  const plist = path.join(target, "Contents/Info.plist");
  for (const key of ["CFBundleName", "CFBundleDisplayName"])
    execFileSync("plutil", ["-replace", key, "-string", "Sprue", plist]);

  const iconset = path.join(desktopRoot, ".dev/icon.iconset");
  await rm(iconset, { recursive: true, force: true });
  await mkdir(iconset);
  for (const size of [16, 32, 128, 256, 512])
    for (const scale of [1, 2]) {
      const name = `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`;
      const px = String(size * scale);
      execFileSync("sips", ["-z", px, px, icon, "--out", path.join(iconset, name)], {
        stdio: "ignore",
      });
    }
  execFileSync("iconutil", [
    "-c",
    "icns",
    iconset,
    "-o",
    path.join(target, "Contents/Resources/electron.icns"),
  ]);
  await rm(iconset, { recursive: true, force: true });

  // Editing Info.plist invalidates Electron's signature; macOS won't run it unsigned on Apple silicon.
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", target], { stdio: "ignore" });
  await writeFile(stampFile, stamp);
  return binary;
}

const binary = process.platform === "darwin" ? await devBundle() : electronBinary;
const child = spawn(binary, args, { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
