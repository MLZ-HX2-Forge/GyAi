# GYAI 全栈项目重构计划

## 项目概述

基于 Flask 和 LangChain 构建完整的中型项目，包含 AI 智能对话、实时监控、系统设置三大功能模块。

## 一、项目目录结构

```
GyAi/
├── FrontEnd/
│   ├── html/
│   │   └── index.html              # 主页面
│   ├── css/
│   │   ├── global.css              # 全局样式
│   │   ├── components/
│   │   │   ├── navbar.css          # 导航栏样式
│   │   │   ├── ai-chat.css         # AI对话样式
│   │   │   ├── live-monitor.css    # 实时监控样式
│   │   │   └── settings.css        # 设置页面样式
│   │   └── landing.css             # 首页介绍样式
│   └── js/
│       ├── app.js                  # 主应用入口
│       ├── utils/
│       │   └── time.js             # 时间工具
│       ├── services/
│       │   ├── llmService.js       # LLM服务
│       │   ├── weatherService.js   # 天气服务
│       │   └── cameraService.js    # 摄像头服务
│       └── components/
│           ├── landing.js          # 首页组件
│           ├── navbar.js           # 导航栏组件
│           ├── ai-chat.js          # AI对话组件
│           ├── live-monitor.js     # 实时监控组件
│           └── settings.js         # 设置组件
├── BackEnd/
│   ├── app.py                      # 应用入口
│   ├── config.py                   # 配置文件
│   ├── requirements.txt            # 依赖清单
│   ├── .env                        # 环境变量示例
│   ├── routes/
│   │   ├── __init__.py
│   │   └── chat.py                 # 对话路由
│   ├── services/
│   │   ├── __init__.py
│   │   └── llm_service.py          # LLM服务封装
│   └── utils/
│       ├── __init__.py
│       └── helpers.py              # 工具函数
```

## 二、功能模块详细设计

### 2.1 AI智能模块

**界面布局（参考DeepSeek）**：

* 左侧边栏：历史对话列表、新建对话按钮、可折叠收缩

* 主区域：对话消息显示区

* 底部：输入框、发送按钮、上传按钮、终止按钮

**核心功能**：

1. 流式输出对话（SSE）
2. 可终止生成
3. 支持上传文本、图片
4. 图片上传自动切换豆包视觉模型
5. 默认使用DeepSeek模型
6. 对话历史管理（新建、删除、切换）
7. 左侧栏折叠/展开

**模型切换逻辑**：

* 无图片：使用默认模型（DeepSeek或用户设置）

* 有图片：自动切换到豆包视觉模型

### 2.2 实时监控模块

**界面布局**：

* 左侧：设备管理树状结构（黑框风格）

* 右侧：视频显示区域

* 底部：设备信息状态栏

**核心功能**：

1. 设备列表显示（仅显示识别到的设备）
2. 摄像头实时预览
3. 设备选择切换
4. 分辨率调整
5. 截取帧功能

### 2.3 系统设置模块

**设置项**：

1. 默认模型选择（DeepSeek/Kimi）
2. API Key 配置
3. 语言设置
4. 其他系统参数

## 三、后端API设计

### 3.1 对话接口

```
POST /api/chat
请求体：
{
    "model": "deepseek" | "kimi" | "doubao",
    "message": "用户消息",
    "history": [...],
    "images": ["base64图片数据"]  // 可选
}
响应：SSE流式响应
```

### 3.2 流式响应格式

```
data: {"content": "部分内容"}
data: {"content": "更多内容"}
data: [DONE]
```

## 四、实施步骤

### 第一阶段：后端基础设施

1. 创建 BackEnd/config.py - 配置管理
2. 创建 BackEnd/.env - 环境变量示例
3. 创建 BackEnd/services/llm\_service.py - LLM服务封装
4. 创建 BackEnd/routes/chat.py - 对话路由
5. 创建 BackEnd/app.py - 应用入口
6. 创建 BackEnd/requirements.txt - 依赖清单

### 第二阶段：前端基础设施

1. 创建 FrontEnd/css/global.css - 全局样式
2. 创建 FrontEnd/css/landing.css - 首页样式
3. 创建 FrontEnd/html/index.html - 主页面
4. 创建 FrontEnd/js/utils/time.js - 时间工具

### 第三阶段：AI智能模块

1. 创建 FrontEnd/css/components/navbar.css
2. 创建 FrontEnd/css/components/ai-chat.css
3. 创建 FrontEnd/js/services/llmService.js
4. 创建 FrontEnd/js/components/navbar.js
5. 创建 FrontEnd/js/components/ai-chat.js
6. 创建 FrontEnd/js/components/landing.js

### 第四阶段：实时监控模块

1. 创建 FrontEnd/css/components/live-monitor.css
2. 创建 FrontEnd/js/services/cameraService.js
3. 创建 FrontEnd/js/components/live-monitor.js

### 第五阶段：系统设置模块

1. 创建 FrontEnd/css/components/settings.css
2. 创建 FrontEnd/js/components/settings.js

### 第六阶段：整合与测试

1. 创建 FrontEnd/js/app.js - 主应用入口
2. 测试所有功能
3. 修复问题

## 五、关键技术点

### 5.1 流式输出实现

**后端**：

```python
from flask import Response, stream_with_context
import json

def generate_stream(model, message, history, images=None):
    # 使用LangChain的stream方法
    for chunk in llm.stream(message):
        yield f"data: {json.dumps({'content': chunk.content})}\n\n"
    yield "data: [DONE]\n\n"
```

**前端**：

```javascript
const eventSource = new EventSource('/api/chat');
eventSource.onmessage = (event) => {
    // 处理流式数据
};
```

### 5.2 图片上传处理

```javascript
// 前端：检测图片上传，自动切换模型
if (hasImage) {
    currentModel = 'doubao';
}
```

### 5.3 左侧栏折叠

```css
.sidebar.collapsed {
    width: 0;
    padding: 0;
    overflow: hidden;
}
```

## 六、环境变量配置

```env
# DeepSeek V3.1
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
DEEPSEEK_MODEL=deepseek-v3-1-terminus

# Kimi
KIMI_API_KEY=your_api_key
KIMI_API_URL=https://ark.cn-beijing.volces.com/api/v3
KIMI_MODEL=kimi-k2-250905

# 豆包图片分析
DOUBAO_ANALYSIS_MODEL=doubao-seed-1-6-vision-250815
DOUBAO_API_KEY=your_api_key
DOUBAO_URL=https://ark.cn-beijing.volces.com/api/v3
```

## 七、依赖清单

```
flask>=2.3.0
flask-cors>=4.0.0
langchain>=0.1.0
langchain-openai>=0.0.5
python-dotenv>=1.0.0
```

## 八、注意事项

1. 所有API Key从环境变量读取，不硬编码
2. 前端CSS、JS、HTML严格分离
3. 后端路由、服务、工具分层清晰
4. 流式输出支持终止功能
5. 图片上传自动切换模型
6. 响应式设计适配多端

