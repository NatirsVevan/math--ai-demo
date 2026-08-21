// =============================================
// 主服务 server.js
// 启动: node server.js   → 打开 http://localhost:3000
// =============================================
const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./db');
const { getAIResponse, fetchAIStream, getAIResponseWithImage } = require('./ai');

const app = express();
// 允许较大的请求体（识图上传 base64 图片需要，默认 100kb 不够）
app.use(express.json({ limit: '20mb' }));

// 提供前端静态文件（index.html 等）
app.use(express.static(path.join(__dirname)));

// 默认学生（原型阶段先写死一个，后续接登录）
const DEFAULT_USER_ID = 1;

// ============== API ==============

// 1. 获取题目列表（可从题库随机取，供"我的练习"用）
app.get('/api/questions', (req, res) => {
  const questions = db.prepare(`
    SELECT id, type, chapter, question,
           option_a, option_b, option_c, option_d
    FROM questions
  `).all();
  res.json({ ok: true, data: questions });
});

// 2. 按知识点/章节查题（可传 ?chapter=）
app.get('/api/questions/by-chapter', (req, res) => {
  const { chapter } = req.query;
  const rows = db.prepare(
    'SELECT * FROM questions WHERE chapter LIKE ?'
  ).all('%' + (chapter || '') + '%');
  res.json({ ok: true, data: rows });
});

// 3. 提交答案并判题
app.post('/api/answers', (req, res) => {
  const { questionId, userAnswer } = req.body;
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!q) return res.status(404).json({ ok: false, error: '题目不存在' });

  // 大小写统一比较
  const correct = String(q.answer).toUpperCase() === String(userAnswer).toUpperCase();

  db.prepare(`
    INSERT INTO records (user_id, question_id, user_answer, is_correct)
    VALUES (?, ?, ?, ?)
  `).run(DEFAULT_USER_ID, questionId, String(userAnswer), correct ? 1 : 0);

  res.json({ ok: true, data: { correct, correctAnswer: q.answer, explain: q.explain } });
});

// 4. 错题本
app.get('/api/wrong-book', (req, res) => {
  const wrong = db.prepare(`
    SELECT r.id, r.user_answer, r.created_at,
           q.question, q.chapter, q.answer, q.explain
    FROM records r
    JOIN questions q ON q.id = r.question_id
    WHERE r.user_id = ? AND r.is_correct = 0
    ORDER BY r.created_at DESC
  `).all(DEFAULT_USER_ID);
  res.json({ ok: true, data: wrong });
});

// 5. AI 学习助手
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const reply = await getAIResponse(message, history || []);

    // 记录对话
    db.prepare('INSERT INTO chat_logs (user_id, question, ai_reply) VALUES (?, ?, ?)')
      .run(DEFAULT_USER_ID, message, reply);

    res.json({ ok: true, data: { reply } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5.5 AI 流式助手（SSE 边想边出字）
app.post('/api/chat-stream', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ ok: false, error: '缺少消息内容' });
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (obj) => { res.write('data: ' + JSON.stringify(obj) + '\n\n'); };
  let fullReply = '';

  try {
    const upstream = await fetchAIStream(message, history || []);

    if (!upstream.ok) {
      if (upstream.status === 429) {
        sendEvent({ error: 'AI 请求有点频繁（限流），请稍等半分钟再试。' });
        return res.end();
      }
      let detail = '';
      try { detail = await upstream.text(); } catch {}
      sendEvent({ error: 'AI 调用失败: ' + upstream.status });
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 逐行解析 SSE 的 data: 块
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          const content = (delta && delta.content) || '';
          if (content) {
            fullReply += content;
            sendEvent({ delta: content });
          }
        } catch { /* 跳过无法解析的分片 */ }
      }
    }

    // 记录对话（整条回复聚合后入库）
    if (fullReply) {
      db.prepare('INSERT INTO chat_logs (user_id, question, ai_reply) VALUES (?, ?, ?)')
        .run(DEFAULT_USER_ID, message, fullReply);
    }

    sendEvent({ done: true });
    res.end();
  } catch (e) {
    sendEvent({ error: e.message });
    res.end();
  }
});

// 5.6 识图搜题（上传题目图片，视觉模型识别 + 启发引导）
app.post('/api/chat-image', async (req, res) => {
  try {
    const { image, message } = req.body;
    if (!image) {
      return res.status(400).json({ ok: false, error: '缺少图片，请先拍照或选择一张题目图片。' });
    }
    const reply = await getAIResponseWithImage(image, message || '');

    db.prepare('INSERT INTO chat_logs (user_id, question, ai_reply) VALUES (?, ?, ?)')
      .run(DEFAULT_USER_ID, '[图片识题] ' + (message || ''), reply);

    res.json({ ok: true, data: { reply } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 6. 学习数据统计
app.get('/api/stats', (req, res) => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(is_correct) AS correct
    FROM records WHERE user_id = ?
  `).get(DEFAULT_USER_ID);

  const total = summary.total || 0;
  const correct = summary.correct || 0;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  // AI 引导次数 = 求助了AI的答题记录 + 对话数（这里简化统计对话次数）
  const aiHelps = db.prepare('SELECT COUNT(*) AS c FROM chat_logs WHERE user_id = ?')
    .get(DEFAULT_USER_ID).c;

  // 连续学习天数（简化：有记录的天数）
  const days = db.prepare(`
    SELECT COUNT(DISTINCT date(created_at)) AS c FROM records WHERE user_id = ?
  `).get(DEFAULT_USER_ID).c;

  res.json({
    ok: true,
    data: {
      total,
      accuracy,
      aiHelps,
      days
    }
  });
});

// 7. 知识点列表（用于"知识点解析"）
app.get('/api/knowledge', (req, res) => {
  const chapters = db.prepare(`
    SELECT chapter, COUNT(*) AS count, GROUP_CONCAT(DISTINCT question) AS sample
    FROM questions GROUP BY chapter
  `).all();
  res.json({ ok: true, data: chapters });
});

// 静态首页兜底
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动
app.listen(config.port, () => {
  console.log('✅ 服务已启动: http://localhost:' + config.port);
  console.log('   用浏览器打开上面的地址即可访问页面');
  console.log('   (若前端页面未连上，请先确认 index.html 在同一个文件夹)');
});
