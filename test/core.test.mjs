import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { checkSource, checkOutput, extractBlocks, lastAssistantText, LIMITS, safeText } from "../src/core.mjs";

const source = "graph LR\n A[Start] --> B[End]";
const wrap = (s, fence = "```") => `${fence}mermaid\n${s}\n${fence}`;

test("extracts fenced Mermaid, including CRLF, tildes, and multiple blocks", () => {
  assert.deepEqual(extractBlocks(wrap(source)), [source]);
  assert.deepEqual(extractBlocks(wrap(source, "~~~~").replaceAll("\n", "\r\n")), [source]);
  assert.deepEqual(extractBlocks(wrap(source) + "\n" + wrap(source)), [source, source]);
  assert.deepEqual(extractBlocks(wrap(source, "````")), [source]);
});

test("ignores other languages, nested fences, and inline text", () => {
  assert.deepEqual(extractBlocks("text ```mermaid\ngraph LR\n```"), []);
  assert.deepEqual(extractBlocks("````text\n" + wrap(source) + "\n````"), []);
  assert.deepEqual(extractBlocks("```javascript\nfoo\n```"), []);
});

test("checks unclosed fences and all input limits before rendering", () => {
  assert.throws(() => extractBlocks("```mermaid\ngraph LR"), /not closed/);
  assert.throws(() => extractBlocks("a".repeat(LIMITS.messageChars + 1)), /100,000/);
  assert.throws(() => extractBlocks(wrap("graph LR\n" + " ".repeat(LIMITS.sourceChars))), /input limit/);
  assert.throws(() => extractBlocks(wrap("graph LR\n" + "\n".repeat(161))), /input limit/);
  assert.throws(() => extractBlocks(Array(4).fill(wrap(source)).join("\n")), /three/);
});

test("unclosed whitespace adversary completes promptly", () => {
  const start = performance.now();
  assert.throws(() => extractBlocks("```mermaid" + " ".repeat(90_000)), /not closed/);
  assert.ok(performance.now() - start < 500, "Extraction should finish within 500 ms");
});

test("rejects control characters, unsupported types, and empty diagrams", () => {
  for (const char of ["\x1b", "\x07", "\u009b", "\u202e", "\u061c", "\u200e", "\u200f"]) {
    assert.throws(() => checkSource(source + char), /control/);
    assert.equal(safeText("before" + char + "after"), "beforeafter");
  }
  assert.throws(() => checkSource("pie\n title Test"), /Unsupported/);
  assert.throws(() => checkSource(""), /empty/);
  assert.equal(checkSource("%% note\nflowchart LR\nA-->B"), "%% note\nflowchart LR\nA-->B");
});

test("sanitizes output and enforces output dimensions", () => {
  const clean = safeText("\x1b]52;c;evil\x07\nA\tB\u009b\u202e");
  assert.ok(!/[\x00-\x09\x0b-\x1f\x7f-\x9f\u202e]/u.test(clean));
  assert.throws(() => checkOutput("a".repeat(LIMITS.outputBytes + 1)), /output limit/);
  assert.throws(() => checkOutput("a".repeat(LIMITS.outputColumns + 1)), /display limit/);
  assert.throws(() => checkOutput("\n".repeat(LIMITS.outputLines)), /display limit/);
});

test("only reads the latest assistant text and bounds multipart messages", () => {
  const assistant = (content) => ({ type: "message", message: { role: "assistant", content } });
  const entries = [assistant(wrap(source)), { type: "message", message: { role: "user", content: "ignore" } }];
  assert.equal(lastAssistantText(entries), wrap(source));
  assert.equal(lastAssistantText([...entries, assistant([{ type: "text", text: "latest" }])]), "latest");
  assert.equal(lastAssistantText([]), "");
  assert.throws(() => lastAssistantText([assistant([{ type: "text", text: "x".repeat(100_001) }])]), /100,000/);
});
