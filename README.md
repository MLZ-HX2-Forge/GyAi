<div align="center">

# GyAI 工业智能助手

**专业的工业AI解决方案，助力企业数字化转型**

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 项目简介

GyAI 工业智能助手是一个面向工业场景的中大型前后端应用系统，集成了先进的AI对话能力，为工业生产提供智能化支持。

### 主要功能

- **智能对话助手** - 基于大语言模型的多轮对话，支持上下文理解
- **设备故障诊断** - 结合知识库快速定位设备故障原因
- **工艺优化建议** - 分析生产数据，提供优化方案
- **视觉识别分析** - 支持图片上传与分析
- **专业知识库** - 内置工业领域专业知识

---

## 技术架构

### 后端技术栈
- **框架**: Python Flask
- **AI集成**: 火山引擎API (DeepSeek/Kimi/豆包)
- **数据库**: SQLite
- **API风格**: RESTful + SSE流式响应

### 前端技术栈
- **技术**: 原生 HTML/CSS/JavaScript
- **设计风格**: 现代工业审美
- **交互**: 丰富的动画效果和动态交互

### 支持的AI模型
| 模型 | 描述 | 适用场景 |
|------|------|----------|
| DeepSeek V3.1 | 深度求索大模型 | 逻辑推理、代码生成 |
| Kimi K2 | 月之暗面大模型 | 长文本理解、分析 |
| 豆包视觉 | 字节跳动视觉模型 | 图片理解、分析 |

---

## 项目结构

```
GyAi/
├── BackEnd/                    # 后端模块
│   ├── app.py                  # 应用入口
│   ├── config.py               # 配置管理
│   ├── requirements.txt        # Python依赖
│   ├── routes/                 # 路由模块
│   │   ├── auth.py            # 用户认证路由
│   │   ├── chat.py            # 对话路由
│   │   └── conversation.py    # 对话管理路由
│   ├── services/              # 服务模块
│   │   ├── auth_service.py    # 认证服务
│   │   ├── llm_service.py     # LLM服务
│   │   └── conversation_service.py  # 对话服务
│   ├── utils/                 # 工具模块
│   │   └── helpers.py         # 工具函数
│   └── data/                  # 数据目录
│
├── FrontEnd/                   # 前端模块
│   ├── html/                  # HTML页面
│   │   ├── index.html         # 主页(产品介绍)
│   │   └── chat.html          # AI对话页面
│   ├── css/                   # 样式文件
│   │   ├── global.css         # 全局样式
│   │   ├── landing.css        # 主页样式
│   │   └── components/        # 组件样式
│   │       ├── navbar.css     # 导航栏样式
│   │       └── ai-chat.css    # 对话页面样式
│   └── js/                    # JavaScript模块
│       ├── utils/             # 工具函数
│       │   └── time.js        # 时间工具
│       ├── services/          # 服务模块
│       │   └── apiService.js  # API服务
│       └── components/        # 组件模块
│           ├── auth.js        # 认证组件
│           ├── chat.js        # 对话组件
│           └── landing.js     # 主页组件
│
├── start.bat                   # Windows启动脚本
├── start.sh                    # Linux/Mac启动脚本
└── README.md                   # 项目说明
```

---

## 快速开始

### 环境要求
- Python 3.8+
- 现代浏览器 (Chrome/Firefox/Edge)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd GyAi
```

2. **安装后端依赖**
```bash
cd BackEnd
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

3. **启动服务**
```bash
# Windows
..\start.bat

# Linux/Mac
cd ..
chmod +x start.sh
./start.sh

# 或直接运行
cd BackEnd
python app.py
```

4. **访问应用**
- 主页面: http://127.0.0.1:5000/
- AI对话: http://127.0.0.1:5000/chat

---

## 功能说明

### 用户系统
- **注册/登录** - 支持用户名密码注册登录
- **游客模式** - 无需注册即可体验核心功能
- **会话管理** - 自动保持登录状态

### AI对话
- **多模型切换** - 支持DeepSeek、Kimi、豆包视觉模型
- **流式输出** - 实时显示AI回复
- **图片上传** - 自动切换视觉模型进行图片分析
- **对话历史** - 自动保存对话记录
- **侧边栏折叠** - 支持展开/收缩操作

### 知识库
- 设备维护
- 安全生产
- 工艺优化
- 质量管理

---

## API接口

### 认证接口
```
POST /api/auth/register  - 用户注册
POST /api/auth/login     - 用户登录
POST /api/auth/guest     - 创建游客账户
POST /api/auth/logout    - 用户登出
GET  /api/auth/me        - 获取当前用户
```

### 对话接口
```
POST /api/chat/stream    - 流式对话(SSE)
POST /api/chat/sync      - 同步对话
GET  /api/chat/models    - 获取模型列表
```

### 对话管理
```
GET    /api/conversations           - 获取对话列表
POST   /api/conversations           - 创建新对话
GET    /api/conversations/:id       - 获取对话详情
PUT    /api/conversations/:id       - 更新对话
DELETE /api/conversations/:id       - 删除对话
GET    /api/conversations/:id/messages - 获取消息列表
```

---

## 配置说明

### 环境变量
复制 `BackEnd/.env.example` 为 `BackEnd/.env` 并配置：

```env
# DeepSeek V3.1
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_MODEL=deepseek-v3-1-terminus

# Kimi
KIMI_API_KEY=your_api_key
KIMI_MODEL=kimi-k2-250905

# 豆包视觉
DOUBAO_VISION_API_KEY=your_api_key
DOUBAO_VISION_MODEL=doubao-seed-1-6-vision-250815
```

---

## 开发指南

### 代码规范
- Python: 遵循 PEP 8 规范
- JavaScript: 使用 ES6+ 语法
- CSS: BEM 命名规范

### 分支管理
- `main` - 主分支
- `develop` - 开发分支
- `feature/*` - 功能分支

---

## 注意事项

⚠️ **本项目由大家共同维护，谨慎修改，避免破坏现有功能！**

📋 **在提交更改前，请确保你已经：**
1. 测试了你的修改
2. 与相关模块负责人沟通

---

## 许可证

本项目采用 MIT 许可证。

---

<div align="center">

**GyAI 工业智能助手** © 2024

</div>
