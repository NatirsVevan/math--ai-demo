# 🧮 初中数学 AI 启发式导学系统

> 面向初中生的 AI 智能辅导平台 —— 不直接给答案，用层层引导让孩子自己学会思考。

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![AI](https://img.shields.io/badge/AI-通义千问%20%2F%20多模型-1677FF)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 项目简介

这是一套**启发式教学**的 AI 辅导系统。与"直接甩答案"的题海工具不同，它基于成熟的启发式教学理念：

- 学生遇到不会的题，AI **不直接给答案**
- 用**层层追问**引导学生说出已知条件 → 一步步推导思路 → 自己解出答案
- 答对思路时给予鼓励，卡住时降低提示难度，全程陪伴式引导
- 支持**拍照 / 传图搜题**（AI 视觉识别题目并引导），也支持**多轮对话**

---

## 🎯 功能特性

- ✅ **启发式对话引擎**：难题引导思考，基础口算题直接给出答案并鼓励
- ✅ **多轮上下文**：AI 能记住对话历史，连续追问不跳戏
- ✅ **流式输出** (`/api/chat-stream`)：答案边生成边显示，体验流畅
- ✅ **拍照搜题** (`/api/chat-image`)：拍照 / 手写触摸自由框选，识别后引导作答
- ✅ **纯文本数学符号**：输出 Unicode 数学符号（`3×5=15`、`x²`、`√4=2`），前端二次兜底，绝无 LaTeX 乱码
- ✅ **题库系统**：内置 sqlite 题库，支持按章节 / 知识点查题
- ✅ **移动端适配**：汉堡菜单导航、非首页返回按钮，手机浏览器也能用

---

## 🧱 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JS + Cropper.js（图片框选） |
| 后端 | Node.js + Express |
| 数据库 | SQLite（`node:sqlite`，零配置） |
| AI 接入 | 通义千问（qwen-plus / qwen-vl-plus）等 **OpenAI 兼容接口** |

> 灵活对接：支持通义千问、智谱 GLM、DeepSeek 等一切 OpenAI 兼容接口，改 `config.js` 即可切换。

---

## 📁 目录结构

```
math-ai-demo/
├── server.js            # 主服务：路由 + 静态托管 + API
├── ai.js                # AI 调用封装（对话 / 流式 / 识图）
├── db.js                # SQLite 数据库初始化
├── import_questions.js  # 题库导入脚本
├── index.html           # 前端页面（移动端适配）
├── questions.example.json  # 题库示例数据
├── config.example.js    # 配置模板（复制为 config.js 使用）
├── cropper.min.js       # 图片框选（前端依赖）
├── cropper.min.css
├── package.json
└── .gitignore           # 已忽略 config.js / node_modules / data.db
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

> 需要 Node.js 18.4+（使用内置 `node:sqlite`，无需额外装数据库）。

### 2. 初始化题库（可选）

```bash
node import_questions.js  # 导入 questions.example.json 中的示例题目
```

### 3. 配置 AI

```bash
cp config.example.js config.js
```

编辑 `config.js`，填入你的 API Key 和模型：

```js
module.exports = {
  port: 3000,
  ai: {
    provider: "qwen",                                   // 供应商
    apiKey: "sk-你的真实Key",                           // ⚠️ 填你自己的
    model: "qwen-plus",                                 // 对话模型
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    imageModel: "qwen-vl-plus"                          // 识图模型
    // ... 提示词略
  }
};
```

### 4. 启动

```bash
npm start        # 或 node server.js
```

浏览器打开 **http://localhost:3000** 即可使用 🎉

---

## 🌐 部署到服务器

```bash
# 1. 将项目传到服务器
scp -r math-ai-demo root@<你的服务器IP>:/root/

# 2. SSH 进入服务器，装依赖、填 config、起服务
cd /root/math-ai-demo
npm install
cp config.example.js config.js   # ⚠️ 在服务器上填真实 Key
nohup node server.js > server.log 2>&1 &   # 后台运行

# 3.（可选）用 pm2 保活，服务器重启自动拉起
pm2 start server.js --name math-ai-demo
pm2 save && pm2 startup
```

> 记得在云服务器控制台**放行 TCP 3000 端口**。

---

## 🔌 API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取题目列表 |
| GET | `/api/questions/by-chapter?chapter=` | 按章节查题 |
| POST | `/api/answers` | 提交作答 / 判题 |
| GET | `/api/wrong-book` | 错题本 |
| POST | `/api/chat` | AI 对话（非流式），body: `{ question, history }` |
| POST | `/api/chat-stream` | AI 对话（流式，SSE） |
| POST | `/api/chat-image` | 拍照 / 传图搜题 |
| GET | `/api/stats` | 学习统计 |
| GET | `/api/knowledge` | 知识点列表 |

---

## 🔒 安全说明

- `config.js`（含 API Key）已被 **`.gitignore` 排除**，不会进入 Git 仓库。
- 团队协作时使用 `config.example.js` 模板，各自填自己的 Key。
- 若曾不小心把 Key 暴露到公开仓库，**请立即到云平台控制台吊销 / 更换**该 Key。

---

## 🏫 项目背景

本项目源于高校「初中数学启发式导学」大学生创新项目，探索**AI 与启发式教学深度融合**的落地路径，让技术真正服务教育教学一线。

---

## 📄 License

[MIT](./LICENSE) © 项目团队
