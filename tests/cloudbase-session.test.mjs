import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

async function harness(now = "2026-10-10T00:00:00.000Z") {
  const data = new Map([["state", { _id: "state", activeQuestion: 0, revealAnswers: true }]]);
  for (let i = 0; i < 205; i++) data.set(`old-${i}`, { _id: `old-${i}`, kind: "response", questionId: "self-introduction", participantId: `p-${i}`, data: { text: "历史回答" }, updatedAt: "2026-08-12" });
  const collection = {
    doc(id) { return { get: async () => ({ data: data.get(id) ? [data.get(id)] : [] }), set: async (value) => data.set(id, { _id: id, ...value }), update: async (value) => data.set(id, { ...data.get(id), ...value }), remove: async () => data.delete(id) }; },
    where(filter) {
      let offset = 0, limit = 100;
      return { skip(value) { offset = value; return this; }, limit(value) { limit = value; return this; }, async get() { return { data: [...data.values()].filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)).slice(offset, offset + limit) }; } };
    },
  };
  const require = createRequire(new URL("../cloudbase-functions/polywork-event-api/index.js", import.meta.url));
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return Date.parse(now); }
  }
  const context = { exports: {}, Date: ClockDate, process: { env: { HOST_KEY: "test-host-key" } }, Buffer, console, require: (name) => name === "@cloudbase/node-sdk" ? { init: () => ({ database: () => ({ collection: () => collection }) }) } : require(name) };
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

test("event answers stay closed until that specific question is revealed", async () => {
  const { main } = await harness();
  const get = async () => JSON.parse((await main({ httpMethod: "GET", queryStringParameters: { all: "1", session: "2026-10-12" } })).body);
  assert.deepEqual((await get()).sessionState.revealedQuestionIds, []);
  const reveal = (hostKey, value) => main({ httpMethod: "POST", body: { action: "setSessionReveal", sessionId: "2026-10-12", questionId: "self-introduction", value, hostKey } });
  assert.equal((await reveal("wrong", true)).statusCode, 401);
  assert.equal((await reveal("test-host-key", true)).statusCode, 200);
  const state = (await get()).sessionState;
  assert.deepEqual(state.revealedQuestionIds, ["self-introduction"]);
  assert.equal(state.revealedQuestionIds.includes("income-map"), false);
  await reveal("test-host-key", false);
  assert.deepEqual((await get()).sessionState.revealedQuestionIds, []);
});
test("queued votes require host refresh and repeated batches are idempotent", async () => {
  const { main } = await harness();
  const post = (body) => main({ httpMethod: "POST", body: { ...body, sessionId: "2026-10-12", all: true } });
  const vote = (syncVersion, value) => post({ action: "syncVotes", participantId: "voter", syncVersion, votes: [{ responseId: "old-0", value }] });
  assert.equal((await vote("invalid", true)).statusCode, 400);
  await post({ action: "setSessionReveal", hostKey: "test-host-key", questionId: "self-introduction", value: true });
  const refresh = JSON.parse((await post({ action: "requestSync", hostKey: "test-host-key" })).body);
  const token = refresh.sessionState.syncVersion;
  assert.ok(token);
  await post({ action: "setSessionReveal", hostKey: "test-host-key", questionId: "self-introduction", value: false });
  const first = JSON.parse((await vote(token, true)).body);
  assert.equal(first.allResponses.find((row) => row.id === "old-0").reactionCount, 1);
  const duplicate = JSON.parse((await vote(token, true)).body);
  assert.equal(duplicate.allResponses.find((row) => row.id === "old-0").reactionCount, 1);
  const cancelled = JSON.parse((await vote(token, false)).body);
  assert.equal(cancelled.allResponses.find((row) => row.id === "old-0").reactionCount, 0);
});

test("host highlighting persists without changing answer text", async () => {
  const { main, data } = await harness();
  for (const value of [true, false]) {
    const result = await main({ httpMethod: "POST", body: { action: "moderate", hostKey: "test-host-key", sessionId: "2026-10-12", responseId: "old-0", field: "highlighted", value, all: true } });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).allResponses.find((response) => response.id === "old-0").highlighted, value);
    assert.equal(data.get("old-0").data.text, "历史回答");
  }
});

test("home and event indexes follow their own order, with excluded questions unavailable in event", async () => {
  const { main } = await harness();
  const get = async (session, question) => JSON.parse((await main({ httpMethod: "GET", queryStringParameters: { all: "1", session, question: String(question) } })).body);
  assert.equal((await get("open", 11)).totalQuestions, 12);
  assert.equal((await get("2026-10-12", 7)).totalQuestions, 8);
  const submit = (sessionId, questionId, viewQuestionIndex, data) => main({ httpMethod: "POST", body: { action: "submit", sessionId, questionId, viewQuestionIndex, participantId: "new-person", all: true, data } });
  assert.equal((await submit("2026-10-12", "choice-spectrum", 0, { reason: "这是足够长的历史题目回答但是本场并未选取这一题" })).statusCode, 400);
  assert.equal((await submit("open", "choice-spectrum", 2, { reason: "这是足够长的历史题目回答常驻主页可以继续填写这一题" })).statusCode, 200);
  const buffer = JSON.parse((await submit("2026-10-12", "one-year-buffer", 2, { note: "这是五年生活费题目的回答用来确认本场第三题正确对应历史题目" })).body);
  assert.equal(buffer.responses[0].questionId, "one-year-buffer");
  for (const [questionId, index] of [["labor-institutions", 6], ["questions-for-others", 7]]) {
    const result = await submit("2026-10-12", questionId, index, { text: "这是新增问题的一份足够长的回答用来确认提交与读取正确" });
    assert.equal(result.statusCode, 200);
    const snapshot = JSON.parse(result.body);
    assert.equal(snapshot.questionIndex, index);
    assert.equal(snapshot.responses[0].questionId, questionId);
    assert.deepEqual(snapshot.sessionState.revealedQuestionIds, []);
  }
});

test("home prefill joins event, edits same response and preserves older home answers", async () => {
  const { main, data } = await harness("2026-10-11T04:00:00.000Z");
  data.set("old-open", { _id: "old-open", kind: "response", sessionId: "open", questionId: "self-introduction", participantId: "p-0", data: { text: "之前主页的回答必须保留" }, updatedAt: "2026-10-10" });
  const post = (sessionId, questionId, answer, index = 0) => main({ httpMethod: "POST", body: { action: "submit", sessionId, participantId: "p-0", questionId, data: answer, viewQuestionIndex: index, all: true } });
  const prefill = JSON.parse((await post("open", "self-introduction", { text: "这是提前在主页填写的回答应当进入十月十二日本场" })).body);
  const eventAnswer = prefill.responses.find(row => row.sessionId === "2026-10-12");
  assert.ok(eventAnswer);
  assert.equal(prefill.totalQuestions, 12);
  assert.equal(prefill.sessionState.sessionId, "open");
  await post("2026-10-12", "self-introduction", { text: "这是现场修改过的回答应该和提前填写的共用一条记录" });
  await post("open", "self-introduction", { text: "这是再次从主页修改的回答还是同一条本场记录不会重复" });
  assert.equal(data.get("old-open").data.text, "之前主页的回答必须保留");
  const eventRows = [...data.values()].filter(row => row.kind === "response" && row.sessionId === "2026-10-12");
  assert.equal(eventRows.length, 1);
  assert.equal(eventRows[0]._id, eventAnswer.id);
  assert.match(eventRows[0].data.text, /再次从主页/);
  const excluded = JSON.parse((await post("open", "choice-spectrum", { reason: "这是本场未选的问题提前从主页填写也只会留在常驻题库" }, 2)).body);
  assert.equal(excluded.responses[0].sessionId, "open");
  const eventView = JSON.parse((await main({ httpMethod: "GET", queryStringParameters: { session: "2026-10-12", all: "1" } })).body);
  assert.deepEqual(eventView.sessionState.revealedQuestionIds, []);
  assert.ok(eventView.responses.some(row => row.id === eventAnswer.id));
});
test("home prefill window ends and new answers return to permanent home", async () => {
  for (const now of ["2026-10-11T03:39:33.999Z", "2026-10-12T16:00:00.000Z"]) {
    const { main } = await harness(now);
    const result = await main({ httpMethod: "POST", body: { action: "submit", sessionId: "open", participantId: "new-person", questionId: "labor-institutions", data: { text: "这是预填时间窗口外填写的回答应该继续属于常驻主页" }, viewQuestionIndex: 8, all: true } });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).responses[0].sessionId, "open");
  }
});
