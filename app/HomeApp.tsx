"use client";

import { useMemo, useState } from "react";
import { questions, type Question } from "../lib/questions";
import { submissionSession } from "../lib/sessions";
import { sitePath } from "../lib/site-paths";
import { responseText } from "./ArchiveApp";
import { getParticipantId, hasMinimumAnswer, initialData, mergeResponses, QuestionFields, sendAction, useSnapshot, type AnswerData, type EventResponse } from "./EventApp";

function HomeAnswerForm({ question, own, disabled, onSubmit }: {
  question: Question; own?: EventResponse; disabled: boolean;
  onSubmit: (question: Question, data: AnswerData) => Promise<void>;
}) {
  const [form, setForm] = useState<AnswerData>(() => own?.data ?? initialData(question));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(""); setError("");
    if (!hasMinimumAnswer(question, form)) { setError("请至少填写 15 个字。你也可以直接浏览大家的回答。"); return; }
    setSaving(true);
    try { await onSubmit(question, form); setMessage("已保存，可以继续修改。"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "提交失败，请重试"); }
    finally { setSaving(false); }
  };
  return <form className="home-answer-form" onSubmit={submit}>
    <fieldset disabled={disabled || saving} className="static-fieldset">
      <QuestionFields question={question} form={form} setForm={setForm} />
      <div className="home-submit-row"><span>匿名提交 · 至少 15 个字</span><button className="os-button primary" type="submit">{saving ? "正在保存……" : own ? "保存修改" : "提交回答"}</button></div>
    </fieldset>
    {message ? <p className="saved-note" role="status">✓ {message}</p> : null}
    {error ? <p className="validation-note" role="alert">{error}</p> : null}
  </form>;
}

function HomeResponse({ response, question, participantId }: { response: EventResponse; question: Question; participantId: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = responseText(question, response.data);
  const long = text.length > 160 || text.split("\n").length > 5;
  return <article className={`archive-response home-response ${response.highlighted ? "is-highlighted" : ""}`}>
    <div className="archive-response-meta"><span>{response.participantId === participantId ? "我的回答" : "匿名回答"}</span>{response.highlighted ? <span>★ 曾被高亮</span> : null}</div>
    <p className={long && !expanded ? "home-response-preview" : ""}>{text}</p>
    {long ? <button className="home-text-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起这条" : "展开这条"}</button> : null}
    <div className="archive-response-foot"><span>♡ {response.reactionCount} 次点赞</span><span>{response.sessionId === "2026-10-12" ? "10.12 本场" : response.sessionId === "open" ? "常驻回答" : "往期回答"}</span></div>
  </article>;
}

export default function HomeApp() {
  const [participantId] = useState(getParticipantId);
  const endpoint = typeof window === "undefined" ? "/api/event" : window.__POLYWORK_API_URL__ || "/api/event";
  const { snapshot, setSnapshot, error, ready } = useSnapshot(participantId, endpoint, undefined, "live");
  const [selected, setSelected] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const responses = useMemo(() => mergeResponses(snapshot.allResponses || [], snapshot.historyResponses || []).filter(response => !response.hidden), [snapshot.allResponses, snapshot.historyResponses]);
  const participants = new Set(responses.map(response => response.participantId)).size;
  const query = search.trim().toLowerCase();
  const visibleQuestions = selected === "all" ? questions : questions.filter(question => question.id === selected);
  const submit = async (question: Question, data: AnswerData) => {
    setSnapshot(await sendAction({ action: "submit", questionId: question.id, participantId, data, viewQuestionIndex: questions.findIndex(item => item.id === question.id) }));
  };
  return <main className="archive-page home-page">
    <header className="archive-header home-header">
      <div className="archive-topline"><span>POLYWORK · INCOME · LIFE</span><a href={sitePath("/1012/")}>参加 10.12 讨论 ↗</a></div>
      <p className="question-eyebrow">多元工作与收入探索 · 共同回答</p>
      <h1>大家是怎么活着的？</h1>
      <p className="archive-lead">从工作、收入和日常经验出发，看看大家正在怎样生活。你可以先读，也可以选一道题，写下自己的回答。</p>
      <div className="archive-stats home-stats">
        <div><b>{ready ? responses.length : "—"}</b><span>条回答</span></div>
        <div><b>{ready ? participants : "—"}</b><span>位参与者</span></div>
        <div><b>{questions.length}</b><span>个问题</span></div>
      </div>
    </header>
    <section className="archive-controls home-controls" aria-label="筛选回答">
      <label>查看问题<select value={selected} onChange={event => setSelected(event.target.value)}><option value="all">全部问题</option>{questions.map(question => <option key={question.id} value={question.id}>{question.number} {question.title}</option>)}</select></label>
      <label>搜索回答<input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索工作、钱、AI……" /></label>
      <p>按点赞从多到少排列 · 不填写也能看全部回答</p>
    </section>
    {error ? <p className="archive-error" role="alert">{error}；当前保留已读取的回答，最新条数尚未确认。</p> : null}
    {!ready ? <p className="archive-loading">正在打开大家的回答……</p> : null}
    {ready ? <section className="archive-sections home-sections">
      {visibleQuestions.map(question => {
        const ordered = responses.filter(response => response.questionId === question.id && (!query || responseText(question, response.data).toLowerCase().includes(query)))
          .sort((left, right) => right.reactionCount - left.reactionCount || left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
        const expanded = Boolean(expandedQuestions[question.id]);
        const displayed = expanded ? ordered : ordered.slice(0, 6);
        const own = responses.find(response => response.questionId === question.id && response.participantId === participantId && response.sessionId === submissionSession(question.id, "open"));
        return <article className="archive-question home-question" id={`question-${question.id}`} key={question.id}>
          <div className="archive-question-heading"><div><p className="question-eyebrow">{question.number} / {question.eyebrow}</p><h2>{question.title}</h2></div><b>{ordered.length} 条</b></div>
          <div className="home-question-copy">
            <div className="archive-question-intro">
              {question.prompt.trim() !== question.title.trim() && <p>{question.prompt}</p>}
              {question.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
          <div className="home-answer-toolbar"><span>点赞最多的回答先出现</span><details className="home-compose"><summary>{own ? "修改我的回答" : "填写我的回答"} ✎</summary><HomeAnswerForm question={question} own={own} disabled={Boolean(error)} onSubmit={submit} /></details></div>
          <div className="archive-response-grid home-response-grid" aria-label={`${question.title}的回答`}>
            {displayed.map(response => <HomeResponse key={response.id} response={response} question={question} participantId={participantId} />)}
            {!ordered.length ? <p className="archive-empty">{query ? "没有匹配的回答。" : "这题还没有回答，欢迎写下你的想法。"}</p> : null}
          </div>
          {ordered.length > 6 ? <button className="archive-more-button" aria-expanded={expanded} type="button" onClick={() => setExpandedQuestions(previous => ({ ...previous, [question.id]: !expanded }))}>{expanded ? "收起回答 ↑" : `展开全部 ${ordered.length} 条回答 ↓`}</button> : null}
        </article>;
      })}
    </section> : null}
    <footer className="archive-footer"><span>每一种工作与生活经验，都可以从这里继续展开。</span><a href={sitePath("/1012/")}>前往 10.12 参与端 ↗</a></footer>
  </main>;
}
