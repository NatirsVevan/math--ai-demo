// =============================================
// 数据库初始化
// 使用 Node.js 内置的 node:sqlite（无需安装第三方插件、无需编译）
// 文件: data.db 会在首次运行时自动创建
// =============================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data.db'));

db.exec(`PRAGMA journal_mode = WAL;`);

// ---------- 建表 ----------
// 学生表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    grade TEXT,
    class TEXT,
    student_no TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// 题库表
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'choice',
    chapter TEXT,
    question TEXT NOT NULL,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    answer TEXT NOT NULL,
    explain TEXT
  );
`);

// 答题记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    question_id INTEGER,
    user_answer TEXT,
    is_correct INTEGER,
    ai_helped INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
`);

// AI 对话记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    question TEXT,
    ai_reply TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ---------- 示例题库（仅首次插入一次）----------
const count = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO questions (type, chapter, question, option_a, option_b, option_c, option_d, answer, explain)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const questions = [
    ['choice', '一元一次方程', '解方程：3x + 5 = 20，x 等于多少？', '4', '5', '6', '7', 'B', '移项得 3x = 15，故 x = 5。'],
    ['choice', '分式运算', '计算 1/2 + 1/3 的结果是？', '2/5', '5/6', '1/5', '3/5', 'B', '通分：1/2=3/6，1/3=2/6，相加 = 5/6。'],
    ['choice', '有理数', '计算：(-3) × (-4) 等于？', '-12', '-7', '12', '7', 'C', '负负得正，3×4=12。'],
    ['choice', '几何初步', '一个三角形的内角和是多少度？', '90', '180', '270', '360', 'B', '三角形内角和恒为 180 度。'],
    ['choice', '有理数', '-5 的绝对值是？', '5', '-5', '0', '1/5', 'A', '绝对值表示到原点的距离，-5 的绝对值为 5。']
  ];

  for (const q of questions) insert.run(...q);
  console.log('✔ 已写入示例题目');
}

module.exports = db;
