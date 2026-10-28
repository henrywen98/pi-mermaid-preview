import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkOutput, checkSource, LIMITS } from "./core.mjs";

const WORKER = fileURLToPath(new URL("./render-worker.mjs", import.meta.url));

/**
 * @param {string} source
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>}
 */
export function renderIsolated(source, options = {}) {
  checkSource(source);
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(new Error("Rendering was cancelled."));
  return new Promise((resolve, reject) => {
    // No shell, diagram arguments, inherited credentials, or Node loader flags.
    const child = spawn(process.execPath, ["--max-old-space-size=128", "--disable-proto=throw", WORKER], {
      stdio: ["pipe", "pipe", "pipe"], env: {}, windowsHide: true,
    });
    let settled = false;
    let output = "";
    let bytes = 0;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      child.kill("SIGKILL");
      if (error) reject(error);
      else resolve(result);
    };
    const cancel = () => finish(new Error("Rendering was cancelled."));
    const timer = setTimeout(() => finish(new Error("Rendering exceeded the three-second limit.")), LIMITS.timeoutMs);
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > LIMITS.outputBytes) return finish(new Error("The rendered diagram exceeds the output limit."));
      output += chunk;
    });
    // Drain stderr without collecting untrusted or unbounded error text.
    child.stderr.resume();
    child.on("error", () => finish(new Error("The renderer process could not start.")));
    child.stdin.on("error", () => finish(new Error("The renderer process stopped.")));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) return finish(new Error("The renderer could not process this diagram."));
      try { finish(null, checkOutput(output)); } catch (error) { finish(error); }
    });
    child.stdin.end(JSON.stringify({ source }));
  });
}
