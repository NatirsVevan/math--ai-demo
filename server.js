// =============================================
// 主服务 server.js
// 启动: node server.js   → 打开 http://localhost:3000
// =============================================
const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./db');
const { getAIResponse } = require('./ai');

const app = express();
app.use(express.json());

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
