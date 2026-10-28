import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, sliceByColumn, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { extractBlocks, lastAssistantText, safeText } from "./src/core.mjs";
import { renderIsolated } from "./src/runner.mjs";

export default function mermaidPreview(pi: ExtensionAPI) {
  let busy = false;
  let active: AbortController | undefined;
  pi.on("session_shutdown", () => active?.abort());

  pi.registerCommand("mermaid", {
    description: "Preview a Mermaid diagram from the last assistant reply: /mermaid [1-3]",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") {
        if (ctx.hasUI) ctx.ui.notify("Mermaid preview requires interactive terminal mode.", "warning");
        return;
      }
      if (busy) {
        ctx.ui.notify("A Mermaid preview is already open.", "info");
        return;
      }
      const selection = args.trim() || "1";
      if (!/^[1-3]$/.test(selection)) {
        ctx.ui.notify("Usage: /mermaid [1-3]", "info");
        return;
      }
      busy = true;
      active = new AbortController();
      try {
        const blocks = extractBlocks(lastAssistantText(ctx.sessionManager.getBranch()));
        const source = blocks[Number(selection) - 1];
        if (!source) {
          ctx.ui.notify(blocks.length ? "That diagram does not exist in the last reply." : "No Mermaid diagram found in the last assistant reply.", "info");
          return;
        }
        ctx.ui.notify("Rendering Mermaid preview...", "info");
        const ascii = await renderIsolated(source, { signal: active.signal });
        if (active.signal.aborted) return;
        const lines = ascii.split("\n");
        await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
          let top = 0;
          let left = 0;
          let page = 10;
          const maxLeft = Math.max(0, ...lines.map((line) => visibleWidth(line)));
          return {
            render(width) {
              page = Math.max(1, (tui.terminal.rows || 24) - 5);
              top = Math.min(top, Math.max(0, lines.length - page));
              const header = theme.fg("accent", `Mermaid ${selection}/${blocks.length} — terminal preview`);
              const hint = theme.fg("dim", "Arrows: scroll · Page Up/Down: page · Esc or q: close");
              return [
                truncateToWidth(header, width),
                ...lines.slice(top, top + page).map((line) => sliceByColumn(line, left, width, true)),
                truncateToWidth(hint, width),
              ];
            },
            handleInput(data) {
              if (data === "q" || keybindings.matches(data, "tui.select.cancel")) {
                done();
                return;
              }
              if (keybindings.matches(data, "tui.select.up")) top = Math.max(0, top - 1);
              else if (keybindings.matches(data, "tui.select.down")) top = Math.min(Math.max(0, lines.length - page), top + 1);
              else if (matchesKey(data, Key.pageUp)) top = Math.max(0, top - page);
              else if (matchesKey(data, Key.pageDown)) top = Math.min(Math.max(0, lines.length - page), top + page);
              else if (matchesKey(data, Key.left)) left = Math.max(0, left - 4);
              else if (matchesKey(data, Key.right)) left = Math.min(maxLeft, left + 4);
              else return;
              tui.requestRender();
            },
            invalidate() {},
          };
        });
      } catch (error) {
        if (!active.signal.aborted) {
          const message = error instanceof Error ? error.message : "Mermaid preview failed.";
          ctx.ui.notify(safeText(message).slice(0, 240), "warning");
        }
      } finally {
        active = undefined;
        busy = false;
      }
    },
  });
}
