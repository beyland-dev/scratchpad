import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  Core,
  builtinWorkspaceRoot,
  defaultWorkspaceRoot,
  initWorkspace,
  readUserSettings,
  updateUserSettings,
  userSettingsFile,
} from "../src/index.ts";

interface Location {
  current: string;
  next: string;
  configured: string | null;
  restartRequired: boolean;
}

let dir: string;
let root: string;
let core: Core;
const saved = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, SPRUE_HOME: process.env.SPRUE_HOME };

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "sp-location-"));
  // Keep the real ~/.config/sprue/settings.json out of reach.
  process.env.XDG_CONFIG_HOME = path.join(dir, "config");
  delete process.env.SPRUE_HOME;
  root = path.join(dir, "workspace");
  await initWorkspace(root, { project: "Shop", example: false });
  core = await Core.open({ root });
});

afterEach(async () => {
  await core.close();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

describe("workspace location", () => {
  test("is saved per user and picked up by defaultWorkspaceRoot", async () => {
    expect(userSettingsFile()).toBe(path.join(dir, "config", "sprue", "settings.json"));
    expect(defaultWorkspaceRoot()).toBe(builtinWorkspaceRoot());

    const next = path.join(dir, "elsewhere");
    const out = await core.run<Location>("workspace.setLocation", { path: next });
    expect(out).toMatchObject({ current: root, next, configured: next, restartRequired: true });
    expect(JSON.parse(await readFile(userSettingsFile(), "utf8"))).toEqual({ workspace: next });

    // Other settings survive a location change.
    await updateUserSettings({ appIcon: "blue" });
    await core.run("workspace.setLocation", { path: next });
    expect(readUserSettings()).toEqual({ workspace: next, appIcon: "blue" });
    expect(defaultWorkspaceRoot()).toBe(next);

    // $SPRUE_HOME still wins.
    expect(defaultWorkspaceRoot({ ...process.env, SPRUE_HOME: root })).toBe(root);

    const reset = await core.run<Location>("workspace.setLocation", { path: null });
    expect(reset.configured).toBeNull();
    expect(defaultWorkspaceRoot()).toBe(builtinWorkspaceRoot());
  });

  test("accepts an existing workspace and rejects non-empty folders and relative paths", async () => {
    const out = await core.run<Location>("workspace.setLocation", { path: root });
    expect(out).toMatchObject({ next: root, restartRequired: false });

    const busy = path.join(dir, "busy");
    await mkdir(busy);
    await writeFile(path.join(busy, "notes.txt"), "hi");
    await expect(core.run("workspace.setLocation", { path: busy })).rejects.toThrow(/isn't empty/);
    await expect(core.run("workspace.setLocation", { path: "relative/dir" })).rejects.toThrow(
      /absolute path/,
    );
  });

  test("ignores a malformed settings file", async () => {
    await mkdir(path.dirname(userSettingsFile()), { recursive: true });
    await writeFile(userSettingsFile(), "{ not json");
    expect(defaultWorkspaceRoot()).toBe(builtinWorkspaceRoot());
  });
});
