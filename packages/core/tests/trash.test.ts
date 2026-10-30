import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { Core, initWorkspace, type TrashEntry } from "../src/index.ts";

let root: string;
let core: Core;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "sp-trash-"));
  await initWorkspace(root, { project: "Shop", example: false });
  core = await Core.open({ root });
});

afterEach(async () => {
  await core.close();
  await rm(root, { recursive: true, force: true });
});

async function trash(): Promise<TrashEntry[]> {
  return (await core.run<{ entries: TrashEntry[] }>("trash.list", {})).entries;
}

describe("trash", () => {
  test("lists and restores project content", async () => {
    await core.run("prototype.create", { title: "Checkout" });
    await core.run("system.create", { id: "shop", name: "Shop", prefix: "shop" });
    await core.run("review.create", { title: "Checkout feedback" });
    await core.run("prototype.delete", { id: "checkout" });
    await core.run("system.delete", { id: "shop" });
    await core.run("review.delete", { id: "checkout-feedback" });

    const entries = await trash();
    expect(entries.map((entry) => entry.kind).sort()).toEqual(["prototype", "review", "system"]);
    for (const entry of entries) {
      expect(entry).toMatchObject({ project: "shop", restorable: true });
      await core.run("trash.restore", { id: entry.id });
    }
    expect(core.prototypes.get("checkout").title).toBe("Checkout");
    expect(core.systems.get("shop").name).toBe("Shop");
    expect(core.reviews.get("checkout-feedback").title).toBe("Checkout feedback");
    expect(await trash()).toEqual([]);
  });

  test("permanently deletes entries and restores projects", async () => {
    await core.run("prototype.create", { title: "Checkout" });
    await core.run("prototype.delete", { id: "checkout" });
    const [prototype] = await trash();
    await core.run("trash.delete", { id: prototype!.id });
    expect(await trash()).toEqual([]);

    await core.run("project.delete", { id: "shop" });
    const [project] = await trash();
    expect(project).toMatchObject({
      kind: "project",
      itemId: "shop",
      restorable: true,
    });
    await core.run("trash.restore", { id: project!.id });
    expect(core.projects.get("shop").name).toBe("Shop");
  });

  test("empties every trash folder", async () => {
    await core.run("prototype.create", { title: "Checkout" });
    await core.run("review.create", { title: "Checkout feedback" });
    await core.run("prototype.delete", { id: "checkout" });
    await core.run("review.delete", { id: "checkout-feedback" });
    expect(await trash()).toHaveLength(2);

    const result = await core.run<{ count: number }>("trash.empty", {});
    expect(result.count).toBe(2);
    expect(await trash()).toEqual([]);
  });
});
