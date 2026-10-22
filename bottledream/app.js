const API = 'https://agent2026-d5goi0noda51a261b-1446728973.ap-shanghai.app.tcloudbase.com/bottledream-api';
const questions = [
  { id: 'impression', text: '看完这些档案，\n给你留下最深印象的是什么？' },
  { id: 'enough', text: '怎样的收入、职业或生存状态，\n让你觉得足够好？' },
  { id: 'protection', text: '你关注哪些劳动议题？\n你希望大家在工作中，能有什么样的保障？' },
];
const receipts = {};
for (const q of questions) { try { receipts[q.id] = localStorage.getItem('bottledream-receipt-' + q.id) || ''; } catch {} }
let unlocked = false, total = 0;
let active = 0, answers = [], requestId = null, loading = false;
const drafts = questions.map(() => '');
const $ = id => document.getElementById(id);
function render() {
  $('number').textContent = `QUESTION 0${active + 1} / 问题${['一','二','三'][active]}`;
  $('question').textContent = questions[active].text;
  document.querySelectorAll('nav button').forEach((b,i) => b.setAttribute('aria-pressed', String(i === active)));
  const rows = answers.filter(a => a.questionId === questions[active].id);
  $('answers').hidden = false;
  $('answers').classList.toggle('preview', !unlocked);
  $('unlock').hidden = unlocked || !total;
  $('unlock').textContent = `提交你的回答查看全部 ${total} 条`;
  $('count').textContent = `${total} 条`;
  if (rows.length && $('load-status').textContent.includes('这面墙还没有回答')) $('load-status').textContent = '';
  $('wall').replaceChildren(...rows.map(a => {
    const article = document.createElement('article'); article.className = 'note';
    const text = document.createElement('p'); text.textContent = a.text;
    const author = document.createElement('small'); author.textContent = (a.previous ? '此前回答 · ' : '') + (a.name || '匿名朋友');
    article.append(text, author); return article;
  }));
}
async function load() {
  const questionId = questions[active].id;


  loading = true; $('refresh').disabled = true; $('load-status').textContent = '正在取回大家的回答……';
  try {
    const response = await fetch(API + '?question=' + questionId + '&receipt=' + encodeURIComponent(receipts[questionId] || ''), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const value = await response.json();
    if (!response.ok || !Array.isArray(value.answers)) throw Error(value.error || '读取失败');
    if (questions[active].id !== questionId) return false;
    answers = value.answers; total = value.total; unlocked = value.unlocked; render();
    $('load-status').textContent = answers.some(a => a.questionId === questions[active].id) ? '' : '这面墙还没有回答，欢迎贴上第一张。'; return true;
  } catch { $('load-status').textContent = '暂时没能取回回答，请点“刷新回答”重试。'; return false; }
  finally { loading = false; $('refresh').disabled = false; }
}
document.querySelectorAll('nav button').forEach((button,i) => button.addEventListener('click', () => {
  drafts[active] = $('answer').value; active = i; answers = []; total = 0; unlocked = false; $('answer').value = drafts[i]; requestId = null; $('submit-status').textContent = ''; render(); load();
}));
$('refresh').addEventListener('click', load);
$('answer').addEventListener('input', () => { requestId = null; });
$('name').addEventListener('input', () => { requestId = null; });
document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault();
  const text = $('answer').value.trim(), name = $('name').value.trim(), questionId = questions[active].id;
  if (!text || Array.from(text).length > 2000 || Array.from(name).length > 30) { $('submit-status').textContent = '请写下回答（最多 2000 字），署名最多 30 字。'; return; }
  requestId ||= crypto.randomUUID(); $('submit').disabled = true;
  document.querySelectorAll('nav button').forEach(b => b.disabled = true);
  $('submit-status').textContent = '正在贴上回答……';
  try {
    const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, name, questionId, requestId }), signal: AbortSignal.timeout(20000) });
    const value = await response.json(); if (!response.ok || !value.ok) throw Error(value.error || '提交失败');
    receipts[questionId] = requestId;
    try { localStorage.setItem('bottledream-receipt-' + questionId, requestId); } catch {}
    $('answer').value = ''; drafts[active] = ''; requestId = null;
    render();
    $('submit-status').textContent = '已贴上，谢谢你留下自己的声音。'; await load();
  } catch (error) { $('submit-status').textContent = `暂未确认提交成功，请重试。${error.message === '提交失败' ? '' : '你的文字还在。'}`; }
  finally { $('submit').disabled = false; document.querySelectorAll('nav button').forEach(b => b.disabled = false); }
});
render();
load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
