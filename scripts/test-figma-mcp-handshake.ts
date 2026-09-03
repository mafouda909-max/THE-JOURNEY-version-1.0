import { spawn } from "node:child_process";

async function testFigmaWrite() {
  console.log("==========================================================");
  console.log("   TESTING FIGMA CONNECTOR WRITE (render_html)           ");
  console.log("==========================================================\n");

  const binPath = "/home/user/.npm/_npx/8bbeeb5e9bb74251/node_modules/@ai.to.design/figma-connector/dist/bin.js";

  const child = spawn("node", [binPath], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr?.on("data", (data) => {
    console.log("[server log]:", data.toString("utf8").trim());
  });

  let requestId = 1;
  const pending = new Map<number, (res: any) => void>();
  let buffer = "";

  child.stdout?.on("data", (data) => {
    buffer += data.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.id !== undefined && pending.has(json.id)) {
          const resolve = pending.get(json.id)!;
          pending.delete(json.id);
          resolve(json);
        }
      } catch {
        /* line parsing */
      }
    }
  });

  const sendRPC = (method: string, params?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      pending.set(id, resolve);
      const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      child.stdin?.write(req);

      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`MCP RPC timeout on method ${method}`));
        }
      }, 5000);
    });
  };

  try {
    // 1. Handshake initialize
    await sendRPC("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "journey-agent-host", version: "1.0.0" },
    });
    child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    // 2. Call render_html
    console.log("Calling tool 'render_html'...");
    const writeRes = await sendRPC("tools/call", {
      name: "render_html",
      arguments: {
        name: "THE JOURNEY — FIGMA WRITE TEST",
        html: `<div class="journey-test-frame" style="width: 400px; height: 300px; padding: 24px; background-color: #0F172A; border-radius: 12px;">
          <h1 style="color: #38BDF8; font-size: 24px;">THE JOURNEY</h1>
        </div>`,
      },
    });
    console.log("Write Tool Result:", JSON.stringify(writeRes, null, 2));

    child.kill();
  } catch (err) {
    console.error("Write execution failed:", err);
    child.kill();
  }
}

testFigmaWrite().catch(console.error);
