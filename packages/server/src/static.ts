import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
};

export function mimeTypeFor(file: string): string {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Read a file from disk as a Response. Directories resolve to their
 * `index.html`. Returns undefined when nothing exists at `absPath`.
 */
export async function fileResponse(
  absPath: string,
  headers: Record<string, string> = {},
): Promise<Response | undefined> {
  let target = absPath;
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, "index.html");
      if (!(await stat(target)).isFile()) return undefined;
    } else if (!info.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const body = await readFile(target);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": mimeTypeFor(target),
      "content-length": String(body.byteLength),
      ...headers,
    },
  });
}
