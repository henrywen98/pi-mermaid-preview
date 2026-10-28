import { renderMermaidAscii } from "beautiful-mermaid";
import { checkOutput, checkSource, LIMITS } from "./core.mjs";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input) > LIMITS.sourceChars * 6 + 1024) process.exit(1);
});
process.stdin.on("end", () => {
  try {
    const source = checkSource(JSON.parse(input).source);
    const ascii = checkOutput(renderMermaidAscii(source, {
      colorMode: "none", paddingX: 2, boxBorderPadding: 1,
    }));
    process.stdout.write(ascii);
  } catch {
    // Do not forward parser errors that can contain untrusted terminal commands.
    process.stderr.write("The renderer could not process this diagram.");
    process.exitCode = 1;
  }
});
