import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderIsolated } from "../src/runner.mjs";

const source = "graph LR\n A[Start] --> B[End]";

test("renders a real diagram without terminal escapes", async () => {
  const result = await renderIsolated(source);
  assert.match(result, /Start/);
  assert.match(result, /End/);
  assert.ok(!result.includes("\x1b"));
});

test("reports malformed renderer input without echoing it", async () => {
  await assert.rejects(renderIsolated("graph WRONG\n A-->B"), /could not process/);
});

test("honors cancellation before launch and during execution", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(renderIsolated(source, { signal: controller.signal }), /cancelled/);
  const active = new AbortController();
  const promise = renderIsolated(source, { signal: active.signal });
  active.abort();
  await assert.rejects(promise, /cancelled/);
});

// Copy production runner code to a temporary directory. Replace only the worker,
// so timeout and output-limit tests need no production backdoors or test flags.
async function fixture(t, code) {
  const dir = await mkdtemp(join(tmpdir(), "mermaid-preview-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const file of ["runner.mjs", "core.mjs"]) {
    await writeFile(join(dir, file), await readFile(new URL("../src/" + file, import.meta.url)));
  }
  await writeFile(join(dir, "render-worker.mjs"), code);
  return import(pathToFileURL(join(dir, "runner.mjs")).href);
}

test("kills a blocked worker at the deadline", async (t) => {
  const runner = await fixture(t, "process.stdin.resume(); while (true) {}");
  const start = Date.now();
  await assert.rejects(runner.renderIsolated(source), /three-second/);
  assert.ok(Date.now() - start < 6_000);
});

test("bounds worker stdout and handles a crash", async (t) => {
  const oversized = await fixture(t, 'process.stdin.resume();process.stdout.write("X".repeat(200000));');
  await assert.rejects(oversized.renderIsolated(source), /output limit/);
  const crash = await fixture(t, "process.exit(1)");
  await assert.rejects(crash.renderIsolated(source), /could not process|stopped/);
});

test("does not pass parent credentials or Node loader options to a worker", async (t) => {
  const worker = await fixture(t, 'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify(process.env)));');
  const previous = process.env.MERMAID_PREVIEW_TEST_SECRET;
  process.env.MERMAID_PREVIEW_TEST_SECRET = "test-only";
  try {
    const result = await worker.renderIsolated(source);
    assert.equal(result, "{}");
  } finally {
    if (previous === undefined) delete process.env.MERMAID_PREVIEW_TEST_SECRET;
    else process.env.MERMAID_PREVIEW_TEST_SECRET = previous;
  }
});
