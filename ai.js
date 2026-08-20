// =============================================
// AI 调用封装 (阶段三)
// 当前: 未配置 key 时返回提示占位
// =============================================
const config = require('./config');

/**
 * 调用大模型，返回启发式引导回复。
 * @param {string} userQuestion 学生提问
 * @param {Array} history      可选历史对话
 * @returns {Promise<string>}  AI 回复文本
 */
async function getAIResponse(userQuestion, history = []) {
  const { apiKey, model, baseUrl, prompt } = config.ai;

  // 未填 key 时给出占位提示
  if (!apiKey || apiKey.includes('在此填入')) {
    return '（后端尚未配置 API key：请在 config.js 中填入你的 key）\n这是一条占位回复。示例：这道题，先想想已知条件是什么？';
  }

  // 组装消息
  const messages = [{ role: 'system', content: prompt }];
  // history: [{role:'user'|'assistant', content}]
  for (const m of history) messages.push(m);
  messages.push({ role: 'user', content: userQuestion });

  const url = baseUrl + '/chat/completions';

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.6
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('AI 调用失败: ' + resp.status + ' ' + text);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

module.exports = { getAIResponse };
