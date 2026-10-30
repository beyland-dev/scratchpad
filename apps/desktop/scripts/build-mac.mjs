import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("The macOS DMG must be built on macOS");

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

await Promise.all(
  ["mac-universal", "mac-universal-x64-temp", "mac-universal-arm64-temp"].map((dir) =>
    rm(path.join(root, "release", dir), { recursive: true, force: true }),
  ),
);
run("pnpm", ["exec", "electron-builder", "--dir", "--mac", "--universal", "--publish", "never"]);
run("hdiutil", [
  "create",
  "-volname",
  "Sprue",
  "-srcfolder",
  "release/mac-universal",
  "-ov",
  "-format",
  "UDZO",
  `release/Sprue-${version}-mac-universal.dmg`,
]);
