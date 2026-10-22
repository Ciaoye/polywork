const crypto = require('node:crypto');
const ids = ['impression', 'enough', 'protection'];
exports.handle = async (event, db, reply) => {
  const collection = db.collection('bottledream_answers');
  const method = String(event.httpMethod || event.requestContext?.httpMethod || 'GET').toUpperCase();
  if (method === 'GET') {
    const answers = [];
    for (let skip = 0; ; skip += 100) {
      const page = await collection.orderBy('createdAt', 'desc').skip(skip).limit(100).get();
      const rows = page.data || [];
      answers.push(...rows.map(({ _id, questionId, text, name, createdAt }) => ({ id: _id, questionId, text, name, createdAt })));
      if (rows.length < 100) break;
    }
    return reply(200, { answers });
  }
  if (method !== 'POST') return reply(405, { error: '不支持的请求方式' });
  let value;
  try { value = typeof event.body === 'object' ? event.body : JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body || '{}'); }
  catch { return reply(400, { error: '回答格式有误' }); }
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!ids.includes(value.questionId) || !text || Array.from(text).length > 2000 || Array.from(name).length > 30 || !/^[a-zA-Z0-9-]{16,80}$/.test(value.requestId || '')) return reply(400, { error: '请填写回答（最多 2000 字），署名最多 30 字' });
  const id = crypto.createHash('sha256').update(value.requestId).digest('hex');
  await db.runTransaction(async transaction => {
    const doc = transaction.collection('bottledream_answers').doc(id);
    const result = await doc.get();
    if (!result.data || (Array.isArray(result.data) && !result.data.length)) await doc.set({ questionId: value.questionId, text, name: name || '匿名朋友', createdAt: new Date().toISOString() });
  });
  return reply(200, { ok: true, id });
};

const app = require('@cloudbase/node-sdk').init({ env: require('@cloudbase/node-sdk').SYMBOL_DEFAULT_ENV });
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' };
exports.main = async event => {
 const reply = (statusCode, value) => ({statusCode, headers, body: JSON.stringify(value), isBase64Encoded:false});
 if (String(event.httpMethod || event.requestContext?.httpMethod).toUpperCase() === 'OPTIONS') return reply(204, {});
 try { return await exports.handle(event, app.database(), reply); }
 catch(error) { console.error(error); return reply(500, {error:'回答暂时无法读取或保存，请重试'}); }
};
