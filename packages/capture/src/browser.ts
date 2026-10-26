import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { z } from "zod";
import { CoreError } from "@design-tool/core";

export const StepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), url: z.string() }),
  z.object({
    action: z.literal("click"),
    selector: z.string(),
    button: z.enum(["left", "right", "middle"]).optional(),
  }),
  z.object({ action: z.literal("hover"), selector: z.string() }),
  z.object({ action: z.literal("focus"), selector: z.string() }),
  z.object({ action: z.literal("type"), text: z.string(), selector: z.string().optional() }),
  z.object({ action: z.literal("press"), key: z.string().describe("e.g. 'Enter', 'Control+K'") }),
  z.object({ action: z.literal("wait"), ms: z.number().int().nonnegative() }),
  z.object({
    action: z.literal("waitFor"),
    selector: z.string(),
    state: z.enum(["attached", "detached", "visible", "hidden"]).default("visible"),
  }),
  z.object({
    action: z.literal("eval"),
    expression: z.string().describe("JavaScript evaluated in the page"),
  }),
  z.object({
    action: z.literal("script"),
    code: z
      .string()
      .describe("Body of an async function run in Node with `page` (Playwright Page) in scope"),
  }),
]);
export type Step = z.infer<typeof StepSchema>;

export const TargetSchema = z.object({
  url: z.string().optional().describe("Page to open (http(s) or file URL)"),
  cdp: z
    .string()
    .optional()
    .describe(
      "Connect to a running Chromium/Electron app over CDP instead, e.g. http://127.0.0.1:9222",
    ),
  page: z
    .string()
    .optional()
    .describe("With cdp: pick the open page whose URL or title contains this text"),
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(800),
  scale: z.number().positive().default(2).describe("Device scale factor (screenshots)"),
  colorScheme: z.enum(["light", "dark"]).optional(),
  waitFor: z
    .string()
    .optional()
    .describe("Selector to wait for after loading (attached to the DOM; it need not be visible)"),
  steps: z
    .array(StepSchema)
    .default([])
    .describe("Interactions to run before capturing (open a menu, hover, switch theme, …)"),
  timeoutMs: z.number().int().positive().default(30_000),
});
export type Target = z.infer<typeof TargetSchema>;

let launched: Promise<Browser> | undefined;
let idleTimer: NodeJS.Timeout | undefined;
let active = 0;
const IDLE_MS = 60_000;

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = (error as Error).message;
    if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
      throw new CoreError(
        "INTERNAL",
        "No Chromium for capture is installed. Run `dt capture.setup` (or `pnpm exec playwright-core install chromium-headless-shell`).",
      );
    }
    throw error;
  }
}

function sharedBrowser(): Promise<Browser> {
  launched ??= launchBrowser().catch((error: unknown) => {
    launched = undefined;
    throw error;
  });
  return launched;
}

function scheduleIdleClose(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (active === 0) void closeBrowser();
  }, IDLE_MS);
  idleTimer.unref();
}

export async function closeBrowser(): Promise<void> {
  clearTimeout(idleTimer);
  const current = launched;
  launched = undefined;
  if (current) await (await current.catch(() => undefined))?.close().catch(() => undefined);
}

export async function runSteps(page: Page, steps: Step[], timeoutMs: number): Promise<void> {
  for (const step of steps) {
    switch (step.action) {
      case "goto":
        await page.goto(step.url, { waitUntil: "load", timeout: timeoutMs });
        break;
      case "click":
        await page
          .locator(step.selector)
          .first()
          .click({ timeout: timeoutMs, button: step.button });
        break;
      case "hover":
        await page.locator(step.selector).first().hover({ timeout: timeoutMs });
        break;
      case "focus":
        await page.locator(step.selector).first().focus({ timeout: timeoutMs });
        break;
      case "type":
        if (step.selector) await page.locator(step.selector).first().focus({ timeout: timeoutMs });
        await page.keyboard.insertText(step.text);
        break;
      case "press":
        await page.keyboard.press(step.key);
        break;
      case "wait":
        await page.waitForTimeout(step.ms);
        break;
      case "waitFor":
        await page
          .locator(step.selector)
          .first()
          .waitFor({ state: step.state, timeout: timeoutMs });
        break;
      case "eval":
        await page.evaluate(step.expression);
        break;
      case "script": {
        // Deliberate: setup scripts are agent-authored Playwright code run locally.
        // oxlint-disable-next-line typescript/no-implied-eval
        const fn = new Function("page", `return (async () => { ${step.code} })();`) as (
          page: Page,
        ) => Promise<unknown>;
        await fn(page);
        break;
      }
    }
  }
}

/** Open (or attach to) a page for the target, run setup, call `fn`, and clean up. */
export async function withPage<T>(
  input: z.input<typeof TargetSchema>,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const target = TargetSchema.parse(input);
  if (target.cdp) {
    const browser = await chromium.connectOverCDP(target.cdp, { timeout: target.timeoutMs });
    try {
      const pages = browser.contexts().flatMap((c) => c.pages());
      let page: Page | undefined;
      for (const candidate of pages) {
        if (!target.page) {
          page = candidate;
          break;
        }
        if (
          candidate.url().includes(target.page) ||
          (await candidate.title().catch(() => "")).includes(target.page)
        ) {
          page = candidate;
          break;
        }
      }
      if (!page)
        throw new CoreError(
          "NOT_FOUND",
          `No page${target.page ? ` matching ${JSON.stringify(target.page)}` : ""} at ${target.cdp}`,
        );
      if (target.url) await page.goto(target.url, { waitUntil: "load", timeout: target.timeoutMs });
      if (target.waitFor)
        await page
          .locator(target.waitFor)
          .first()
          .waitFor({ state: "attached", timeout: target.timeoutMs });
      await runSteps(page, target.steps, target.timeoutMs);
      return await fn(page);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
  if (!target.url) throw new CoreError("INVALID_INPUT", "A target needs a url (or a cdp endpoint)");
  active++;
  let context: BrowserContext | undefined;
  try {
    const browser = await sharedBrowser();
    context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      deviceScaleFactor: target.scale,
      ...(target.colorScheme ? { colorScheme: target.colorScheme } : {}),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(target.timeoutMs);
    await page.goto(target.url, { waitUntil: "load", timeout: target.timeoutMs });
    if (target.waitFor)
      await page
        .locator(target.waitFor)
        .first()
        .waitFor({ state: "attached", timeout: target.timeoutMs });
    await runSteps(page, target.steps, target.timeoutMs);
    return await fn(page);
  } finally {
    await context?.close().catch(() => undefined);
    active--;
    scheduleIdleClose();
  }
}

/** Install the headless Chromium used for capture. */
export function installBrowser(): Promise<{ installed: boolean; output: string }> {
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve("playwright-core/package.json")), "cli.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "install", "chromium-headless-shell"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d: Buffer) => (output += d.toString()));
    child.stderr.on("data", (d: Buffer) => (output += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve({ installed: true, output: output.trim().split("\n").slice(-3).join("\n") })
        : reject(new Error(output)),
    );
  });
}

/**
 * Wait for fonts and jump finite CSS animations/transitions to their end state (e.g. fade-in or
 * scale-in on overlays), so measurements and screenshots are deterministic.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const animation of document.getAnimations()) {
      try {
        const timing = animation.effect?.getComputedTiming();
        if (timing && timing.endTime !== Infinity) animation.finish();
      } catch {
        // Infinite animations can't be finished.
      }
    }
  });
}
