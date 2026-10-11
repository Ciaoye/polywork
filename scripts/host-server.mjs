import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, extname, sep } from "node:path";

try { process.loadEnvFile(); } catch { /* A missing host key is reported by the action endpoint. */ }
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
async function publish(snapshot) {
  let branch;
  try { branch = await github("git/ref/heads/live-data"); } catch {
    const main = await github("git/ref/heads/main");
    branch = await github("git/refs", "POST", { ref: "refs/heads/live-data", sha: main.object.sha });
  }
  if (!branch) throw new Error("无法读取数据分支");
  const published = { publishedAt: new Date().toISOString(), sessionState: snapshot.sessionState, allResponses: snapshot.allResponses.filter((item) => !item.hidden) };
  const snapshotPath = `snapshots/${Date.now()}-${randomUUID()}.json`;
  await github(`contents/${snapshotPath}`, "PUT", { message: "Publish immutable event snapshot", branch: "live-data", content: Buffer.from(JSON.stringify(published)).toString("base64") });
  let signalSha;
  try { signalSha = (await github("contents/signal.json?ref=live-data")).sha; } catch { /* First signal. */ }
  await github("contents/signal.json", "PUT", { message: "Notify event views of the published snapshot", branch: "live-data", ...(signalSha ? { sha: signalSha } : {}), content: Buffer.from(JSON.stringify({ publishedAt: published.publishedAt, snapshotPath })).toString("base64") });
}
async function readBody(request) {
  let text = "";
  for await (const chunk of request) { text += chunk; if (text.length > 2000000) throw new Error("请求过大"); }
  return JSON.parse(text);
}
async function upstream(payload) {
  const response = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, hostKey: process.env.HOST_KEY }), signal: AbortSignal.timeout(25000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "腾讯云操作失败");
  return data;
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:3000");
  const json = (status, value) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); };
  try {
    if (url.pathname.startsWith("/api/")) {
      if (!/^localhost:3000$|^127\.0\.0\.1:3000$/.test(request.headers.host || "")) return json(403, { error: "仅允许本机访问" });
      if (request.headers.origin && !["http://localhost:3000", "http://127.0.0.1:3000"].includes(request.headers.origin)) return json(403, { error: "来源不允许" });
      if (url.pathname === "/api/host-action" && request.method === "GET") {
        const result = await fetch(`${api}?${url.searchParams}`, { signal: AbortSignal.timeout(20000) });
        return json(result.status, await result.json());
      }
      if (url.pathname === "/api/host-action" && request.method === "POST") {
        if (publishing) return json(409, { error: "正在同步，请稍候" });
        if (!process.env.HOST_KEY) return json(503, { error: "本地主持密钥尚未配置" });
        publishing = true;
        try {
          const payload = await readBody(request);
          if (!["setSessionReveal", "moderate", "requestSync"].includes(payload.action)) return json(400, { error: "操作不支持" });
          let snapshot = await upstream(payload);
          await publish(snapshot);
          if (payload.action === "requestSync") {
            // One bounded collection window after an explicit host refresh.
            // No recurring Tencent polling; participants flush queued votes once for this nonce.
            await new Promise((done) => setTimeout(done, 30000));
            const params = new URLSearchParams({ participant: "host", session: payload.sessionId, all: "1", question: String(payload.viewQuestionIndex || 0) });
            const result = await fetch(`${api}?${params}`, { signal: AbortSignal.timeout(20000) });
            snapshot = await result.json();
            if (!result.ok) throw new Error(snapshot.error || "收集投票失败");
            await publish(snapshot);
            snapshot.syncNotice = "已刷新并收集在线参与者的暂存投票；离线或缓存延迟的投票会在后续刷新补齐。";
          }
          return json(200, snapshot);
        } finally { publishing = false; }
      }
      return json(404, { error: "操作不存在" });
    }
    const pathname = decodeURIComponent(url.pathname).replace(/^\/polywork\/?/, "/");
    const servedPath = extname(pathname) ? pathname : "/index.html";
    const file = resolve(root, `.${servedPath}`);
    if (!file.startsWith(root + sep)) return json(403, { error: "路径不允许" });
    const content = await readFile(file);
    response.writeHead(200, { "content-type": `${mime[extname(file)] || "application/octet-stream"}; charset=utf-8`, "cache-control": "no-cache" });
    response.end(content);
  } catch (error) { json(error.code === "ENOENT" ? 404 : 500, { error: error.message }); }
});
server.listen(3000, "127.0.0.1", () => console.log("主持端：http://localhost:3000/host/1012/"));
