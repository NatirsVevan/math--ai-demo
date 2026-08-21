// =============================================
// AI 调用封装
// 已接入：智谱 / 通义(千问 qwen) / DeepSeek 等 OpenAI 兼容接口
// 本版本针对通义(千问)优化：
//   1) 429 限流 -> 快速失败并给出友好提示（不再长时间傻等重试）
//   2) 支持流式输出（fetchAIStream），供 /api/chat-stream 转发给前端
// =============================================
const config = require('./config');

// 检测是否已配置 API Key
function ensureConfigured() {
  const { apiKey } = config.ai;
  if (!apiKey || apiKey.includes('在此填入')) {
    const err = new Error('AI 尚未配置 API Key，请在 config.js 中填写。');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
}

// 组装请求体
function buildBody(userQuestion, history = [], stream = false) {
  const { model, prompt } = config.ai;
  const messages = [{ role: 'system', content: prompt }];
  for (const m of history || []) messages.push(m);
  messages.push({ role: 'user', content: userQuestion });
  return { model, messages, temperature: 0.6, stream };
}

// 鉴权请求头
function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + config.ai.apiKey
  };
}

const completionsUrl = () => config.ai.baseUrl + '/chat/completions';

/**
 * 非流式调用：返回完整回复文本。
 * 429 限流 -> 直接抛出友好提示，不做长时间重试。
 * @param {string} userQuestion
 * @param {Array}  history  可选历史对话 [{role,content}]
 * @returns {Promise<string>}
 */
async function getAIResponse(userQuestion, history = []) {
  ensureConfigured();
  const body = buildBody(userQuestion, history, false);
  let lastErr = '';
  // 最多重试 1 次（应对偶发网络抖动）
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, 1000));
    let resp;
    try {
      resp = await fetch(completionsUrl(), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body)
      });
    } catch (e) {
      lastErr = '网络错误: ' + e.message;
      continue;
    }

    if (resp.ok) {
      const data = await resp.json();
      return data.choices[0].message.content;
    }
    if (resp.status === 429) {
      // 限流：友好提示，不硬等
      throw new Error('AI 请求有点频繁（限流），请稍等半分钟再试。');
    }
    const text = await resp.text();
    throw new Error('AI 调用失败: ' + resp.status + ' ' + text);
  }
  throw new Error('AI 请求失败，请检查网络后重试。' + (lastErr ? '（' + lastErr + '）' : ''));
}

/**
 * 流式调用：返回上游 fetch 的 Response（text/event-stream），
 * 由 server.js 的 /api/chat-stream 转发给前端逐步渲染。
 * @param {string} userQuestion
 * @param {Array}  history
 * @returns {Promise<Response>}
 */
async function fetchAIStream(userQuestion, history = []) {
  ensureConfigured();
  const body = buildBody(userQuestion, history, true);
  return fetch(completionsUrl(), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
}

/**
 * 识图搜题：把题目图片发给视觉模型（qwen-vl），返回识别的题目 + 启发式引导。
 * @param {string} imageBase64  图片 base64（可含 data: 前缀）
 * @param {string} userText     学生补充文字（可空）
 * @returns {Promise<string>}
 */
async function getAIResponseWithImage(imageBase64, userText = '') {
  ensureConfigured();
  const imageModel = config.ai.imageModel || 'qwen-vl-plus';
  const imgUrl = String(imageBase64).startsWith('data:')
    ? imageBase64
    : 'data:image/jpeg;base64,' + imageBase64;

  const body = {
    model: imageModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgUrl } },
        {
          type: 'text',
          text: '这是一道初中数学题目。请先简要重复/确认你看到的题目，然后作为一位启发式老师引导学生思考，不要直接给答案（基础口算题除外）。数学符号一律用纯文本和 Unicode（如 3×5=15、x²、√4=2、3/4、≠、≤、≥），禁止输出 LaTeX（不要出现 $、\\(、\\)、\\frac、\\times 等）。' +
            (userText ? ' 学生补充说：' + userText : '')
        }
      ]
    }],
    temperature: 0.5,
    stream: false
  };

  const resp = await fetch(completionsUrl(), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error('AI 识图有点频繁（限流），请稍等半分钟再试。');
    }
    const text = await resp.text();
    throw new Error('AI 识图失败: ' + resp.status + ' ' + text);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

module.exports = { getAIResponse, fetchAIStream, getAIResponseWithImage };
