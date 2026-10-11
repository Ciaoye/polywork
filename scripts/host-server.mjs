import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, extname, sep } from "node:path";

const execute = promisify(execFile);
const root = resolve("github-pages-dist");
const api = "https://agent2026-d5goi0noda51a261b.service.tcloudbase.com/polywork-api";
const repository = "repos/Ciaoye/polywork";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
let publishing = false;
async function github(path, method = "GET", body) {
  const args = ["api", `${repository}/${path}`, "--method", method];
  if (body) {
    const file = resolve(".wrangler/publish-request.json");
    await mkdir(resolve(".wrangler"), { recursive: true });
    await writeFile(file, JSON.stringify(body), "utf8");
    args.push("--input", file);
  }
  const { stdout } = await execute("gh", args, { windowsHide: true });
  return stdout ? JSON.parse(stdout) : {};
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:3000");
  const json = (status, value) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); };
  try {
    if (url.pathname.startsWith("/api/")) {
      if (!/^localhost:3000$|^127\.0\.0\.1:3000$/.test(request.headers.host || "")) return json(403, { error: "仅允许本机访问" });
      if (request.headers.origin && !["http://localhost:3000", "http://127.0.0.1:3000"].includes(request.headers.origin)) return json(403, { error: "来源不允许" });
      if (url.pathname === "/api/host-action" && request.method === "GET") {
        const upstream = await fetch(`${api}?${url.searchParams}`, { signal: AbortSignal.timeout(20000) });
        return json(upstream.status, await upstream.json());
      }
      if (url.pathname === "/api/publish" && request.method === "POST") {
        if (publishing) return json(409, { error: "上一份快照正在发布，请稍候" });
        publishing = true;
        try {
          let body = "";
          for await (const chunk of request) { body += chunk; if (body.length > 2000000) throw new Error("快照过大"); }
          const data = JSON.parse(body);
          if (!Array.isArray(data.allResponses)) throw new Error("快照内容不完整");
          let branch;
          try { branch = await github("git/ref/heads/live-data"); } catch {
            const main = await github("git/ref/heads/main");
            branch = await github("git/refs", "POST", { ref: "refs/heads/live-data", sha: main.object.sha });
          }
          if (!branch) throw new Error("无法读取数据分支");
          let sha;
          try { sha = (await github("contents/snapshot.json?ref=live-data")).sha; } catch { /* First publication. */ }
          const snapshot = { publishedAt: new Date().toISOString(), allResponses: data.allResponses.filter((item) => !item.hidden) };
          await github("contents/snapshot.json", "PUT", { message: "Update shared event snapshot", branch: "live-data", ...(sha ? { sha } : {}), content: Buffer.from(JSON.stringify(snapshot)).toString("base64") });
          return json(200, { publishedAt: snapshot.publishedAt });
        } finally { publishing = false; }
      }
      return json(404, { error: "操作不存在" });
    }
    let pathname = decodeURIComponent(url.pathname).replace(/^\/polywork\/?/, "/");
    if (!extname(pathname)) pathname = "/index.html";
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) return json(403, { error: "路径不允许" });
    const content = await readFile(file);
    response.writeHead(200, { "content-type": `${mime[extname(file)] || "application/octet-stream"}; charset=utf-8`, "cache-control": "no-cache" });
    response.end(content);
  } catch (error) { json(error.code === "ENOENT" ? 404 : 500, { error: error.message }); }
});
server.listen(3000, "127.0.0.1", () => console.log("主持端：http://localhost:3000/host/1012/"));
