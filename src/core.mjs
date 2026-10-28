export const LIMITS = Object.freeze({
  messageChars: 100_000,
  sourceChars: 8_000,
  sourceLines: 160,
  blocks: 3,
  timeoutMs: 3_000,
  outputBytes: 128 * 1024,
  outputLines: 2_000,
  outputColumns: 2_000,
});

const UNSAFE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\p{Bidi_Control}]/u;
const SUPPORTED = new Set([
  "graph", "flowchart", "sequenceDiagram", "classDiagram",
  "erDiagram", "stateDiagram", "stateDiagram-v2",
]);

export function checkSource(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("The diagram is empty.");
  if (source.length > LIMITS.sourceChars) throw new Error("The diagram exceeds 8,000 characters.");
  if (source.split("\n").length > LIMITS.sourceLines) throw new Error("The diagram exceeds 160 lines.");
  if (UNSAFE.test(source)) throw new Error("The diagram contains control or bidirectional characters.");
  const first = source.split("\n").find((line) => line.trim() && !line.trim().startsWith("%%"));
  const type = first?.trim().split(/[\s;]/u)[0];
  if (!SUPPORTED.has(type)) throw new Error("Unsupported diagram type. Use a flowchart, sequence, class, ER, or state diagram.");
  return source;
}

// Line-based fence scanning avoids overlapping, unbounded regex repetition.
export function extractBlocks(text) {
  if (typeof text !== "string") throw new Error("The message is not text.");
  if (text.length > LIMITS.messageChars) throw new Error("The message exceeds 100,000 characters.");
  const blocks = [];
  let fence = null;
  let lines = [];
  let sourceLength = 0;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        if (fence.mermaid) {
          blocks.push(checkSource(lines.join("\n").trim()));
          if (blocks.length > LIMITS.blocks) throw new Error("The message exceeds three Mermaid diagrams.");
        }
        fence = null;
        lines = [];
        sourceLength = 0;
      } else if (fence.mermaid) {
        sourceLength += line.length + (lines.length ? 1 : 0);
        lines.push(line);
        // Bound partial, unterminated blocks before any parsing or rendering.
        if (lines.length > LIMITS.sourceLines || sourceLength > LIMITS.sourceChars) {
          throw new Error("The diagram exceeds the input limit.");
        }
      }
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/u);
    if (open) {
      fence = { char: open[1][0], length: open[1].length, mermaid: /^mermaid[ \t]*$/iu.test(open[2].trim()) };
    }
  }
  if (fence?.mermaid) throw new Error("The Mermaid code block is not closed.");
  return blocks;
}

export function lastAssistantText(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const content = entry.message.content;
    const parts = typeof content === "string" ? [content] :
      Array.isArray(content) ? content.filter((p) => p.type === "text").map((p) => p.text) : [];
    let text = "";
    for (const part of parts) {
      if (typeof part !== "string") continue;
      if (text.length + part.length + 1 > LIMITS.messageChars) throw new Error("The message exceeds 100,000 characters.");
      text += (text ? "\n" : "") + part;
    }
    if (text.trim()) return text;
  }
  return "";
}

export function safeText(text) {
  return String(text).replace(/\t/g, "  ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\p{Bidi_Control}]/gu, "");
}

export function checkOutput(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > LIMITS.outputBytes) {
    throw new Error("The rendered diagram exceeds the output limit.");
  }
  const clean = safeText(text);
  const lines = clean.split("\n");
  if (lines.length > LIMITS.outputLines || lines.some((line) => line.length > LIMITS.outputColumns)) {
    throw new Error("The rendered diagram exceeds the display limit.");
  }
  return clean;
}
