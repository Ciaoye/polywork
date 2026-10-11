import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

async function harness() {
  const data = new Map([["state", { _id: "state", activeQuestion: 0, revealAnswers: true }]]);
  for (let i = 0; i < 205; i++) data.set(`old-${i}`, { _id: `old-${i}`, kind: "response", questionId: "self-introduction", participantId: `p-${i}`, data: { text: "历史回答" }, updatedAt: "2026-08-12" });
  const collection = {
    doc(id) { return { get: async () => ({ data: data.get(id) ? [data.get(id)] : [] }), set: async (value) => data.set(id, { _id: id, ...value }), update: async (value) => data.set(id, { ...data.get(id), ...value }), remove: async () => data.delete(id) }; },
    where(filter) {
      let offset = 0, limit = 100;
      return { skip(value) { offset = value; return this; }, limit(value) { limit = value; return this; }, async get() { return { data: [...data.values()].filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)).slice(offset, offset + limit) }; } };
    },
  };
  const require = createRequire(import.meta.url);
  const context = { exports: {}, process: { env: {} }, Buffer, console, require: (name) => name === "@cloudbase/node-sdk" ? { init: () => ({ database: () => ({ collection: () => collection }) }) } : require(name) };
  vm.runInNewContext(await readFile(new URL("../cloudbase-functions/polywork-event-api/index.js", import.meta.url), "utf8"), context);
  return { main: context.exports.main, data };
}
test("unanswered participants see complete paginated history", async () => {
  const { main } = await harness();
  const result = await main({ httpMethod: "GET", queryStringParameters: { all: "1", participant: "new-person", question: "0" } });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).allResponses.length, 205);
  assert.equal(result.headers["cache-control"], "no-store");
});
test("same participant has independent answers per session and edits only that session", async () => {
  const { main, data } = await harness();
  const submit = (sessionId, text) => main({ httpMethod: "POST", body: { action: "submit", sessionId, participantId: "p-0", questionId: "self-introduction", data: { text }, all: true } });
  assert.equal((await submit("open", "这是足够长的通用入口回答用来检验跨场次隔离")).statusCode, 200);
  assert.equal((await submit("2026-10-12", "这是十月十二日的新回答不会覆盖以前的历史回答")).statusCode, 200);
  assert.equal((await submit("2026-10-12", "这是十月十二日更新后的回答只更新本场自己的记录")).statusCode, 200);
  const own = [...data.values()].filter((row) => row.kind === "response" && row.participantId === "p-0");
  assert.equal(own.length, 3);
  assert.equal(own.find((row) => row._id === "old-0").data.text, "历史回答");
  assert.match(own.find((row) => row.sessionId === "2026-10-12").data.text, /更新后/);
  assert.equal((await submit("unknown", "这是足够长的回答但是这个场次并不存在应该拒绝")).statusCode, 400);
});
