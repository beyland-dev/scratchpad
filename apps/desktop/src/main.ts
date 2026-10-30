import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeBrowser, captureCommands } from "@beyland/sprue-capture";
import { Core, defaultWorkspaceRoot } from "@beyland/sprue-core";
import { startServer, type RunningServer } from "@beyland/sprue-server";
import { app, BrowserWindow, dialog, shell } from "electron";

const appDir = path.dirname(fileURLToPath(import.meta.url));
if (process.env.SPRUE_DEBUG_PORT)
  app.commandLine.appendSwitch("remote-debugging-port", process.env.SPRUE_DEBUG_PORT);
let mainWindow: BrowserWindow | null = null;
let core: Core | null = null;
let server: RunningServer | null = null;
let quitting = false;

async function debug(message: string): Promise<void> {
  if (process.env.SPRUE_DEBUG_LOG)
    await appendFile(process.env.SPRUE_DEBUG_LOG, `${message}\n`, "utf8");
}

async function openExternal(url: string): Promise<void> {
  if (/^https?:\/\//.test(url)) await shell.openExternal(url);
}

async function createWindow(): Promise<void> {
  await debug("opening core");
  core = await Core.open({
    root: defaultWorkspaceRoot(),
    watch: true,
    commands: captureCommands,
  });
  await debug("starting server");
  server = await startServer({
    core,
    host: "127.0.0.1",
    port: 0,
    sandboxPort: 0,
    strictPort: true,
    webRoot: path.join(appDir, "web"),
  });
  await debug(`server started at ${server.url}`);

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 880,
    minHeight: 600,
    show: false,
    backgroundColor: "#f7f7f8",
    title: "Sprue",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 14, y: 12 } }
      : {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#77777f",
            height: 38,
          },
        }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  const appOrigin = new URL(server.url).origin;
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || new URL(url).origin === appOrigin) return { action: "allow" };
    void openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin === appOrigin) return;
    event.preventDefault();
    void openExternal(url);
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  const url = new URL(server.url);
  url.searchParams.set("desktop", process.platform);
  await window.loadURL(url.href);
  await debug("window loaded");
}

async function shutdown(): Promise<void> {
  await Promise.all([server?.close(), closeBrowser()]);
  server = null;
  await core?.close();
  core = null;
}

async function reportStartupError(error: unknown): Promise<void> {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error("Sprue could not start", error);
  const logs = app.getPath("logs");
  await mkdir(logs, { recursive: true });
  await writeFile(path.join(logs, "startup-error.log"), `${message}\n`, "utf8");
  dialog.showErrorBox("Sprue could not start", message);
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  void debug("single-instance lock acquired");
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app
    .whenReady()
    .then(createWindow)
    .catch(async (error: unknown) => {
      await reportStartupError(error);
      await shutdown();
      app.quit();
    });
  app.on("activate", () => {
    if (!mainWindow && app.isReady()) void createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", (event) => {
    if (quitting || (!server && !core)) return;
    event.preventDefault();
    quitting = true;
    void shutdown().finally(() => app.quit());
  });
}
