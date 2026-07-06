/**
 * 今天学什么？—— 学习陪伴网站后端服务
 * 
 * 功能：
 * 1. 静态文件托管（前端页面）
 * 2. 代理 DeepSeek API（API Key 隐藏在后端）
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 托管前端静态文件（index.html 放在项目根目录的 public 文件夹中）
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * API 代理端点 —— 生成学习任务
 * 
 * 前端调用此接口，后端转发请求到 DeepSeek API
 * API Key 保存在服务端 .env 文件中，前端无法访问
 */
app.post('/api/generate-task', async (req, res) => {
    try {
        const { subject, status, duration, taskType, difficulty } = req.body;

        // 校验必填字段
        if (!subject || !status || !duration || !taskType) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 检查 API Key 是否已配置
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === 'sk-your-api-key-here') {
            return res.status(503).json({
                error: '服务端未配置 API Key',
                message: '请联系管理员在 .env 文件中配置 DEEPSEEK_API_KEY'
            });
        }

        const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
        const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

        // 构建 AI 提示词
        const prompt = `你是一个学习助手。用户是一名大学生，学习科目是"${subject}"，当前状态是"${status}"，准备学习${duration}分钟，任务类型是"${taskType}"，建议难度是"${difficulty}"。

请为用户生成一个具体可执行的学习任务，严格按照以下JSON格式返回（不要加任何其他文字）：
{
    "title": "任务标题（简短）",
    "steps": ["步骤1", "步骤2", "步骤3", "步骤4"],
    "difficulty": "难度描述",
    "suggestion": "给用户的一段鼓励或学习建议（20字以内）"
}

要求：
- 任务要具体、可执行、有时间感
- 步骤数量根据时间调整（5分钟2步，15分钟3步，25分钟4步，50分钟5步）
- 建议要温暖、鼓励
- 只返回JSON，不要其他内容`;

        // 请求 DeepSeek API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('DeepSeek API 错误:', response.status, errData);
            return res.status(response.status).json({
                error: 'AI 服务暂时不可用',
                detail: errData.error?.message || '未知错误'
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取 JSON（可能被包裹在 ```json 中）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const task = JSON.parse(jsonMatch[0]);
            return res.json({ success: true, task });
        }

        return res.status(500).json({ error: 'AI 返回格式异常' });

    } catch (err) {
        console.error('生成任务失败:', err);
        return res.status(500).json({ error: '服务端错误', message: err.message });
    }
});

/**
 * 健康检查端点
 */
app.get('/api/health', (req, res) => {
    const apiKeyConfigured = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'sk-your-api-key-here';
    res.json({
        status: 'ok',
        ai: apiKeyConfigured ? 'ready' : 'not_configured',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log('');
    console.log('  🌱 今天学什么？—— 后端服务已启动');
    console.log(`  📡 本地访问: http://localhost:${PORT}`);
    console.log(`  🔑 AI 状态: ${process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'sk-your-api-key-here' ? '已配置' : '未配置（请在 server/.env 中设置 DEEPSEEK_API_KEY）'}`);
    console.log('');
});
