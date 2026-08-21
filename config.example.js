// =============================================
//  配置示例（模板）
// -------------------------------------------------
//  使用方式：
//    cp config.example.js config.js
//  然后在 config.js 中填入你自己的真实 API Key。
//
//  ⚠️ 安全提醒：
//    config.js 已被 .gitignore 排除，绝不会随 Git 上传。
//    请勿把真实 Key 写进本文件（config.example.js）并提交。
// =============================================

module.exports = {
  // 服务端口
  port: 3000,

  // ========== AI 接入（OpenAI 兼容接口）==========
  ai: {
    // 供应商标识，可选: qwen(通义千问) / zhipu(智谱) / deepseek
    provider: "qwen",

    // ⚠️ 把你的真实 API Key 填在这里（云平台控制台获取）
    apiKey: "在此填入你的APIKey",

    // 对话模型名
    //   通义千问：qwen-plus（推荐）/ qwen-flash（免费额度另算）
    model: "qwen-plus",

    // OpenAI 兼容接口地址（通义 DashScope 兼容模式）
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",

    // 识图搜题模型（需要视觉能力）
    imageModel: "qwen-vl-plus",

    // 启发式引导提示词（AI 对话的行为准则）
    prompt: [
      "你是一位耐心、启发式的初中数学老师。",
      "学生向你求助题目时，绝对不要直接给出答案。",
      "用层层追问的方式引导学生自己思考：先让ta说出已知条件，再一步步提示解题思路。",
      "当学生答对思路时给予鼓励；当学生卡住时，换个更简单的提示，不要泄题。",
      "语气亲切、有耐心，面向初中生。"
    ].join("\n")
  }
};
