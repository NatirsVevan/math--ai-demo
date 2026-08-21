// =============================================
// 题库批量导入脚本
// 用法:  node import_questions.js questions.json
//
// questions.json 格式（数组）:
// [
//   {
//     "type": "choice",          // 题型: choice(单选) / blank(填空) / solve(解答)
//     "chapter": "一元一次方程",  // 章节/知识点
//     "question": "解方程 3x+5=20，x=?",
//     "option_a": "4", "option_b": "5", "option_c": "6", "option_d": "7",
//     "answer": "B",             // 答案（必须）
//     "explain": "移项得 x=5"    // 解析（可空）
//   },
//   ...
// ]
//
// 重复题（按题目内容判断）会自动跳过，不会重复添加。
// =============================================
const db = require('./db');
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.log('用法: node import_questions.js <题库文件.json>');
  console.log('示例: node import_questions.js questions.json');
  process.exit(0);
}

const raw = fs.readFileSync(file, 'utf8');
const list = JSON.parse(raw);
if (!Array.isArray(list) || list.length === 0) {
  console.log('✘ 文件格式不正确，或题目列表为空。');
  process.exit(1);
}

const find = db.prepare('SELECT id FROM questions WHERE question = ?');
const insert = db.prepare(`
  INSERT INTO questions (type, chapter, question, option_a, option_b, option_c, option_d, answer, explain)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let added = 0, skipped = 0;
for (const q of list) {
  if (!q || !q.question || q.answer === undefined || q.answer === null || q.answer === '') {
    console.log('⚠ 跳过一条（缺少 question 或 answer）:', q);
    continue;
  }
  if (find.get(q.question)) { skipped++; continue; }

  insert.run(
    q.type || 'choice',
    q.chapter || '',
    q.question,
    q.option_a || null,
    q.option_b || null,
    q.option_c || null,
    q.option_d || null,
    String(q.answer),
    q.explain || null
  );
  added++;
}

const total = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
console.log('✔ 导入完成：新增 ' + added + ' 条，跳过重复 ' + skipped + ' 条');
console.log('  当前题库共 ' + total + ' 题');
