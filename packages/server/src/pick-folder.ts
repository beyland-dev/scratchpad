import { execFile } from "node:child_process";

/** Returns the chosen absolute path, null if cancelled, or throws when no picker is available. */
export type FolderPicker = (prompt: string) => Promise<string | null>;

export class PickerUnavailableError extends Error {}

const TIMEOUT_MS = 10 * 60 * 1000;

function run(file: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT")
        return reject(new PickerUnavailableError(`${file} is not installed`));
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ code, stdout: stdout.toString() });
    });
  });
}

/** The OS's native folder dialog. The server runs on the user's machine, so it opens there. */
export const nativeFolderPicker: FolderPicker = async (prompt) => {
  if (process.platform === "darwin") {
    const script = `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`;
    const { code, stdout } = await run("osascript", ["-e", script]);
    return code === 0 ? stdout.trim().replace(/(.)\/$/, "$1") : null;
  }
  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$d.Description = ${JSON.stringify(prompt)}`,
      "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }",
    ].join("; ");
    const { stdout } = await run("powershell", ["-NoProfile", "-STA", "-Command", script]);
    return stdout.trim() || null;
  }
  for (const [file, args] of [
    ["zenity", ["--file-selection", "--directory", `--title=${prompt}`]],
    ["kdialog", ["--getexistingdirectory", ".", "--title", prompt]],
  ] as const) {
    try {
      const { code, stdout } = await run(file, [...args]);
      return code === 0 ? stdout.trim() || null : null;
    } catch (error) {
      if (!(error instanceof PickerUnavailableError)) throw error;
    }
  }
  throw new PickerUnavailableError("No folder picker available (install zenity or kdialog)");
};
