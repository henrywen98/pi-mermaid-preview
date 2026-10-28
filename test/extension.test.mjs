import test from "node:test";
import assert from "node:assert/strict";
import extension from "../index.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

function setup() {
  const commands = {};
  const events = {};
  extension({
    registerCommand(name, command) { commands[name] = command; },
    on(name, handler) { events[name] = handler; },
  });
  return { command: commands.mermaid, events };
}

test("registers only a manual command and a shutdown hook", () => {
  const { command, events } = setup();
  assert.ok(command);
  assert.deepEqual(Object.keys(events), ["session_shutdown"]);
});

test("renders the last reply, clips narrow output, scrolls, and closes", async () => {
  const { command } = setup();
  const notices = [];
  let opened = false;
  const ctx = {
    mode: "tui",
    hasUI: true,
    sessionManager: {
      getBranch: () => [{
        type: "message",
        message: { role: "assistant", content: [{ type: "text", text: "```mermaid\ngraph LR\nA[开始] --> B[End]\n```" }] },
      }],
    },
    ui: {
      notify: (s) => notices.push(s),
      async custom(factory) {
        opened = true;
        let closed = false;
        const component = factory(
          { terminal: { rows: 24 }, requestRender() {} },
          { fg: (_name, text) => text },
          { matches: (data, key) => key === "tui.select.cancel" && data === "\x1b" },
          () => { closed = true; },
        );
        const rendered = component.render(80);
        assert.ok(rendered.join("\n").includes("开始"));
        for (const width of [1, 12, 40, 80]) {
          assert.ok(component.render(width).every((line) => visibleWidth(line) <= width));
        }
        component.handleInput("\x1b[C");
        component.handleInput("\x1b[6~");
        component.render(12);
        component.invalidate();
        component.handleInput("q");
        assert.ok(closed);
      },
    },
  };
  await command.handler("", ctx);
  assert.ok(opened);
  assert.deepEqual(notices, ["Rendering Mermaid preview..."]);
});

test("handles missing blocks, invalid selectors, non-TUI mode, and oversized text", async () => {
  const { command } = setup();
  const notices = [];
  let text = "No diagram";
  const ctx = {
    mode: "tui", hasUI: true,
    sessionManager: { getBranch: () => [{ type: "message", message: { role: "assistant", content: text } }] },
    ui: { notify: (s) => notices.push(s), custom: () => assert.fail("Should not open") },
  };
  await command.handler("bad", ctx);
  await command.handler("", ctx);
  text = "a".repeat(100_001);
  await command.handler("", ctx);
  await command.handler("", { ...ctx, mode: "rpc" });
  assert.equal(notices.length, 4);
  assert.match(notices[0], /Usage/);
  assert.match(notices[1], /No Mermaid/);
  assert.match(notices[2], /100,000/);
  assert.match(notices[3], /interactive/);
});
