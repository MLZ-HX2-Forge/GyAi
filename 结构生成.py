import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import os
from pathlib import Path
import re


class ModernProjectGenerator:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("智能项目结构生成器")
        self.root.geometry("1200x800")

        # 设置应用程序图标
        try:
            self.root.iconbitmap("project_icon.ico")  # 如果你有图标文件
        except:
            pass

        # 项目数据
        self.project_name = ""
        self.project_structure = []

        # 配置根窗口权重
        self.root.grid_rowconfigure(0, weight=1)
        self.root.grid_columnconfigure(0, weight=1)

        # 创建主容器
        self.main_container = ttk.Frame(self.root)
        self.main_container.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)

        # 配置主容器网格
        self.main_container.grid_rowconfigure(1, weight=1)
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_columnconfigure(1, weight=1)

        # 创建界面
        self.create_ui()

        # 绑定窗口大小变化事件
        self.root.bind('<Configure>', self.on_window_resize)

        # 初始状态
        self.window_width = self.root.winfo_width()
        self.window_height = self.root.winfo_height()

    def on_window_resize(self, event):
        """窗口大小变化时的处理"""
        if event.widget == self.root:
            new_width = self.root.winfo_width()
            new_height = self.root.winfo_height()

            # 如果窗口大小变化显著，重新调整布局
            if abs(new_width - self.window_width) > 50 or abs(new_height - self.window_height) > 50:
                self.window_width = new_width
                self.window_height = new_height

                # 根据窗口宽度调整布局
                if new_width < 800:
                    # 小窗口布局
                    self.main_container.grid_columnconfigure(0, weight=1)
                    self.main_container.grid_columnconfigure(1, weight=0)
                    self.right_frame.grid_remove()
                    self.show_right_frame = False
                else:
                    # 大窗口布局
                    self.main_container.grid_columnconfigure(0, weight=1)
                    self.main_container.grid_columnconfigure(1, weight=1)
                    self.right_frame.grid()
                    self.show_right_frame = True

    def create_ui(self):
        """创建用户界面"""
        # 创建标题区域
        self.create_title_frame()

        # 创建左侧输入区域
        self.create_left_frame()

        # 创建右侧预览区域
        self.create_right_frame()

        # 创建底部状态栏
        self.create_status_bar()

    def create_title_frame(self):
        """创建标题区域"""
        title_frame = ttk.Frame(self.main_container, relief="ridge", borderwidth=2)
        title_frame.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 10))

        # 标题
        title_label = tk.Label(title_frame, text="📁 智能项目结构生成器",
                               font=("Arial", 20, "bold"), fg="#2c3e50")
        title_label.pack(side=tk.LEFT, padx=20, pady=10)

        # 版本标签
        version_label = tk.Label(title_frame, text="v4.0",
                                 font=("Arial", 10), fg="#7f8c8d")
        version_label.pack(side=tk.RIGHT, padx=20, pady=10)

    def create_left_frame(self):
        """创建左侧输入区域"""
        left_frame = ttk.LabelFrame(self.main_container, text="输入和配置", padding=15)
        left_frame.grid(row=1, column=0, sticky="nsew", padx=(0, 10))

        # 配置左框架权重
        left_frame.grid_rowconfigure(1, weight=1)
        left_frame.grid_columnconfigure(0, weight=1)

        # 按钮工具栏
        toolbar_frame = ttk.Frame(left_frame)
        toolbar_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        # 创建工具栏按钮
        button_configs = [
            ("📋 加载示例", self.load_example, "#3498db"),
            ("🔍 解析结构", self.parse_structure, "#2ecc71"),
            ("🧹 清空输入", self.clear_input, "#e74c3c"),
            ("📁 选择目录", self.browse_directory, "#9b59b6"),
            ("👁️ 预览结构", self.preview_structure, "#f39c12"),
            ("⚙️ 生成配置", self.show_settings, "#1abc9c"),
        ]

        # 创建两行按钮以适应小屏幕
        top_row = ttk.Frame(toolbar_frame)
        top_row.pack(fill=tk.X, pady=(0, 5))

        bottom_row = ttk.Frame(toolbar_frame)
        bottom_row.pack(fill=tk.X)

        # 分配按钮到两行
        for i, (text, command, color) in enumerate(button_configs):
            if i < 3:  # 前3个在上行
                row_frame = top_row
            else:  # 后3个在下行
                row_frame = bottom_row

            btn = tk.Button(row_frame, text=text, command=command,
                            bg=color, fg="white", font=("Arial", 10, "bold"),
                            padx=15, pady=8, relief="raised", bd=2)
            btn.pack(side=tk.LEFT, padx=2, fill=tk.X, expand=True)

        # 输入文本框区域
        text_frame = ttk.LabelFrame(left_frame, text="粘贴项目树状结构", padding=10)
        text_frame.grid(row=1, column=0, sticky="nsew", pady=(0, 10))
        text_frame.grid_rowconfigure(0, weight=1)
        text_frame.grid_columnconfigure(0, weight=1)

        # 输入文本框
        self.input_text = scrolledtext.ScrolledText(text_frame, font=("Consolas", 10),
                                                    wrap=tk.WORD, bg="#f8f9fa")
        self.input_text.grid(row=0, column=0, sticky="nsew")

        # 目标目录区域
        dir_frame = ttk.Frame(left_frame)
        dir_frame.grid(row=2, column=0, sticky="ew", pady=(0, 10))

        dir_label = tk.Label(dir_frame, text="目标目录:", font=("Arial", 10, "bold"))
        dir_label.pack(side=tk.LEFT, padx=(0, 10))

        self.dir_var = tk.StringVar(value=os.getcwd())
        dir_entry = tk.Entry(dir_frame, textvariable=self.dir_var,
                             font=("Arial", 10), bd=2, relief="sunken")
        dir_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))

        # 选项区域
        options_frame = ttk.LabelFrame(left_frame, text="生成选项", padding=10)
        options_frame.grid(row=3, column=0, sticky="ew")

        # 第一行选项
        row1_frame = ttk.Frame(options_frame)
        row1_frame.pack(fill=tk.X, pady=(0, 5))

        self.overwrite_var = tk.BooleanVar(value=False)
        overwrite_check = tk.Checkbutton(row1_frame, text="覆盖已存在的文件",
                                         variable=self.overwrite_var,
                                         font=("Arial", 10))
        overwrite_check.pack(side=tk.LEFT, padx=(0, 20))

        self.create_empty_var = tk.BooleanVar(value=True)
        create_check = tk.Checkbutton(row1_frame, text="创建空文件",
                                      variable=self.create_empty_var,
                                      font=("Arial", 10))
        create_check.pack(side=tk.LEFT)

        # 第二行选项
        row2_frame = ttk.Frame(options_frame)
        row2_frame.pack(fill=tk.X)

        self.remove_comments_var = tk.BooleanVar(value=True)
        comments_check = tk.Checkbutton(row2_frame, text="移除#注释",
                                        variable=self.remove_comments_var,
                                        font=("Arial", 10))
        comments_check.pack(side=tk.LEFT, padx=(0, 20))

        self.create_gitkeep_var = tk.BooleanVar(value=False)
        gitkeep_check = tk.Checkbutton(row2_frame, text="创建.gitkeep文件",
                                       variable=self.create_gitkeep_var,
                                       font=("Arial", 10))
        gitkeep_check.pack(side=tk.LEFT)

        # 生成按钮区域
        generate_frame = ttk.Frame(left_frame)
        generate_frame.grid(row=4, column=0, sticky="ew")

        self.generate_btn = tk.Button(generate_frame, text="🚀 生成项目结构",
                                      command=self.generate_project,
                                      state=tk.DISABLED,
                                      bg="#27ae60", fg="white",
                                      font=("Arial", 12, "bold"),
                                      padx=20, pady=12, relief="raised", bd=3)
        self.generate_btn.pack(fill=tk.X, pady=(10, 0))

    def create_right_frame(self):
        """创建右侧预览区域"""
        self.right_frame = ttk.LabelFrame(self.main_container, text="解析结果和预览", padding=15)
        self.right_frame.grid(row=1, column=1, sticky="nsew")

        # 配置右框架权重
        self.right_frame.grid_rowconfigure(1, weight=1)
        self.right_frame.grid_columnconfigure(0, weight=1)

        # 项目信息区域
        info_frame = ttk.Frame(self.right_frame)
        info_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        self.project_label = tk.Label(info_frame, text="项目: 未解析",
                                      font=("Arial", 11, "bold"), fg="#34495e")
        self.project_label.pack(side=tk.LEFT)

        self.stats_label = tk.Label(info_frame, text="项目数: 0",
                                    font=("Arial", 10), fg="#7f8c8d")
        self.stats_label.pack(side=tk.RIGHT)

        # 预览文本区域
        preview_frame = ttk.LabelFrame(self.right_frame, text="结构预览", padding=10)
        preview_frame.grid(row=1, column=0, sticky="nsew")
        preview_frame.grid_rowconfigure(0, weight=1)
        preview_frame.grid_columnconfigure(0, weight=1)

        self.preview_text = scrolledtext.ScrolledText(preview_frame,
                                                      font=("Consolas", 9),
                                                      wrap=tk.NONE,
                                                      bg="#ecf0f1",
                                                      state=tk.DISABLED)
        self.preview_text.grid(row=0, column=0, sticky="nsew")

        # 预览工具栏
        preview_toolbar = ttk.Frame(self.right_frame)
        preview_toolbar.grid(row=2, column=0, sticky="ew", pady=(10, 0))

        copy_btn = tk.Button(preview_toolbar, text="📋 复制结构",
                             command=self.copy_structure,
                             bg="#2980b9", fg="white",
                             font=("Arial", 9, "bold"),
                             padx=10, pady=5)
        copy_btn.pack(side=tk.LEFT, padx=(0, 10))

        export_btn = tk.Button(preview_toolbar, text="💾 导出结构",
                               command=self.export_structure,
                               bg="#8e44ad", fg="white",
                               font=("Arial", 9, "bold"),
                               padx=10, pady=5)
        export_btn.pack(side=tk.LEFT)

        clear_preview_btn = tk.Button(preview_toolbar, text="🗑️ 清空预览",
                                      command=self.clear_preview,
                                      bg="#c0392b", fg="white",
                                      font=("Arial", 9, "bold"),
                                      padx=10, pady=5)
        clear_preview_btn.pack(side=tk.RIGHT)

    def create_status_bar(self):
        """创建底部状态栏"""
        status_frame = ttk.Frame(self.main_container, relief="sunken", borderwidth=1)
        status_frame.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(10, 0))

        # 状态消息
        self.status_var = tk.StringVar(value="就绪")
        status_label = tk.Label(status_frame, textvariable=self.status_var,
                                font=("Arial", 9), fg="#2c3e50", anchor="w")
        status_label.pack(side=tk.LEFT, padx=10, pady=3)

        # 进度条（初始隐藏）
        self.progress_bar = ttk.Progressbar(status_frame, mode='indeterminate', length=100)

        # 文件计数
        self.file_count_var = tk.StringVar(value="文件: 0")
        file_label = tk.Label(status_frame, textvariable=self.file_count_var,
                              font=("Arial", 9), fg="#7f8c8d")
        file_label.pack(side=tk.RIGHT, padx=10, pady=3)

    def load_example(self):
        """加载示例项目结构"""
        example = """GyAi/
FrontEnd/
│   ├── assets/
│   │   └── icons/          # 图标资源
│   ├── css/
│   │   ├── base.css        # 基础样式
│   │   ├── components.css  # 组件样式
│   │   ├── layout.css      # 布局样式
│   │   ├── themes.css      # 主题样式
│   │   └── utilities.css   # 工具类样式
│   ├── js/
│   │   ├── app.js          # 主应用
│   │   ├── config.js       # 配置
│   │   ├── utils.js        # 工具函数
│   │   ├── sessionManager.js # 会话管理
│   │   ├── uiManager.js    # UI管理
│   │   ├── apiManager.js   # API管理
│   │   └── eventManager.js # 事件管理
│   ├── pages/
│   │   ├── index.html      # 首页
│   │   └── enter.html      # 主页面
│   └── config.json         # 前端配置
├── BackEnd/
│   ├── src/
│   │   ├── __init__.py
│   │   ├── app.py          # Flask应用
│   │   ├── models.py       # 数据模型
│   │   ├── services/       # 业务服务
│   │   │   ├── __init__.py
│   │   │   ├── safety_expert.py # 安全专家服务
│   │   │   └── file_service.py  # 文件服务
│   │   ├── routes/         # 路由
│   │   │   ├── __init__.py
│   │   │   ├── chat_routes.py   # 聊天路由
│   │   │   ├── file_routes.py   # 文件路由
│   │   │   └── session_routes.py # 会话路由
│   │   ├── utils/          # 工具模块
│   │   │   ├── __init__.py
│   │   │   ├── logger.py   # 日志配置
│   │   │   └── helpers.py  # 帮助函数
│   │   └── config/         # 配置
│   │       ├── __init__.py
│   │       └── settings.py # 应用配置
│   ├── requirements.txt    # 依赖包
│   ├── .env       # 环境变量示例
│   ├── Dockerfile         # Docker配置
│   └── run.py             # 启动脚本
└── README.md              # 项目文档"""

        self.input_text.delete(1.0, tk.END)
        self.input_text.insert(1.0, example)
        self.set_status("示例已加载")

    def clear_input(self):
        """清空输入"""
        self.input_text.delete(1.0, tk.END)
        self.clear_preview()
        self.project_name = ""
        self.project_structure = []
        self.generate_btn.config(state=tk.DISABLED)
        self.project_label.config(text="项目: 未解析")
        self.stats_label.config(text="项目数: 0")
        self.file_count_var.set("文件: 0")
        self.set_status("输入已清空")

    def browse_directory(self):
        """浏览选择目录"""
        directory = filedialog.askdirectory(title="选择目标目录",
                                            initialdir=self.dir_var.get())
        if directory:
            self.dir_var.set(directory)
            self.set_status(f"目标目录: {directory}")

    def show_settings(self):
        """显示设置窗口"""
        settings_window = tk.Toplevel(self.root)
        settings_window.title("高级设置")
        settings_window.geometry("500x400")
        settings_window.resizable(False, False)

        # 居中显示
        settings_window.transient(self.root)
        settings_window.grab_set()

        # 标题
        title_label = tk.Label(settings_window, text="⚙️ 高级设置",
                               font=("Arial", 16, "bold"), fg="#2c3e50")
        title_label.pack(pady=20)

        # 设置内容
        settings_frame = ttk.Frame(settings_window, padding=20)
        settings_frame.pack(fill=tk.BOTH, expand=True)

        # 自动保存设置
        self.auto_save_var = tk.BooleanVar(value=True)
        auto_save_check = tk.Checkbutton(settings_frame, text="自动保存配置",
                                         variable=self.auto_save_var,
                                         font=("Arial", 11))
        auto_save_check.pack(anchor=tk.W, pady=(0, 10))

        # 创建备份设置
        self.create_backup_var = tk.BooleanVar(value=True)
        backup_check = tk.Checkbutton(settings_frame, text="生成前创建备份",
                                      variable=self.create_backup_var,
                                      font=("Arial", 11))
        backup_check.pack(anchor=tk.W, pady=(0, 10))

        # 日志级别
        log_frame = ttk.Frame(settings_frame)
        log_frame.pack(fill=tk.X, pady=(0, 10))

        log_label = tk.Label(log_frame, text="日志级别:", font=("Arial", 11))
        log_label.pack(side=tk.LEFT, padx=(0, 10))

        self.log_level_var = tk.StringVar(value="INFO")
        log_combo = ttk.Combobox(log_frame, textvariable=self.log_level_var,
                                 values=["DEBUG", "INFO", "WARNING", "ERROR"],
                                 state="readonly", width=15)
        log_combo.pack(side=tk.LEFT)

        # 分隔线
        ttk.Separator(settings_frame, orient="horizontal").pack(fill=tk.X, pady=20)

        # 按钮区域
        button_frame = ttk.Frame(settings_frame)
        button_frame.pack(fill=tk.X)

        save_btn = tk.Button(button_frame, text="💾 保存设置",
                             command=lambda: self.save_settings(settings_window),
                             bg="#27ae60", fg="white",
                             font=("Arial", 11, "bold"),
                             padx=20, pady=10)
        save_btn.pack(side=tk.LEFT, padx=(0, 10))

        cancel_btn = tk.Button(button_frame, text="取消",
                               command=settings_window.destroy,
                               bg="#95a5a6", fg="white",
                               font=("Arial", 11),
                               padx=20, pady=10)
        cancel_btn.pack(side=tk.LEFT)

    def save_settings(self, window):
        """保存设置"""
        messagebox.showinfo("设置", "设置已保存")
        window.destroy()

    def parse_structure(self):
        """解析项目结构"""
        text = self.input_text.get(1.0, tk.END).strip()
        if not text:
            messagebox.showwarning("警告", "请输入项目结构文本")
            return

        # 显示进度条
        self.show_progress("正在解析结构...")

        try:
            # 使用新的解析算法
            self.project_name, self.project_structure = self.parse_tree_structure(text)

            if not self.project_structure:
                raise ValueError("解析失败，未找到有效结构")

            # 更新UI
            self.project_label.config(text=f"项目: {self.project_name}")
            item_count = len(self.project_structure)
            self.stats_label.config(text=f"项目数: {item_count}")

            # 显示预览
            self.show_preview()

            # 启用生成按钮
            self.generate_btn.config(state=tk.NORMAL)

            # 更新状态
            self.set_status(f"解析完成！找到 {item_count} 个项目")

            messagebox.showinfo("成功", f"解析完成！\n找到 {item_count} 个项目")

        except Exception as e:
            messagebox.showerror("解析错误", f"解析失败: {str(e)}")
            self.set_status(f"解析错误: {str(e)}")

        finally:
            # 隐藏进度条
            self.hide_progress()

    def parse_tree_structure(self, text):
        """改进的树状结构解析算法"""
        lines = [line.rstrip() for line in text.split('\n') if line.strip()]

        if not lines:
            return "", []

        # 项目名称（第一行）
        project_name = lines[0].rstrip('/').strip()

        # 移除注释
        if self.remove_comments_var.get():
            lines = [re.sub(r'\s*#.*$', '', line).rstrip() for line in lines]
            lines = [line for line in lines if line.strip()]

        # 解析树状结构
        structure = []
        stack = []  # 存储当前路径栈

        for line in lines[1:]:
            # 计算缩进级别
            indent = 0
            i = 0

            # 解析树状字符
            while i < len(line):
                if line[i] in ['├', '└']:
                    indent += 4
                    i += 1
                    if i + 2 <= len(line) and line[i:i + 2] in ['──', '━━']:
                        i += 2
                elif line[i] == '│':
                    indent += 4
                    i += 1
                elif line[i:i + 2] in ['──', '━━']:
                    i += 2
                elif line[i] == ' ':
                    i += 1
                else:
                    break

            # 获取节点名称
            node_text = line[i:].strip()
            node_text = re.sub(r'^[─━\s]+', '', node_text)

            if not node_text:
                continue

            # 判断是否是目录
            is_dir = node_text.endswith('/') or ('.' not in node_text.split('/')[-1])
            node_name = node_text.rstrip('/')

            # 计算层级
            level = max(0, indent // 4 - 1)

            # 调整栈
            while len(stack) > level:
                stack.pop()

            # 构建路径
            if stack:
                parent_path = stack[-1]
                full_path = f"{parent_path}/{node_name}" if parent_path else node_name
            else:
                full_path = node_name

            # 添加到结构
            structure.append({
                'level': level,
                'name': node_name,
                'full_path': full_path,
                'is_dir': is_dir
            })

            # 如果是目录，添加到栈
            if is_dir:
                stack.append(full_path)

        return project_name, structure

    def show_preview(self):
        """显示预览"""
        if not self.project_structure:
            return

        # 启用文本编辑
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)

        # 生成预览内容
        preview_content = f"项目: {self.project_name}\n"
        preview_content += "=" * 60 + "\n\n"

        # 重建树状显示
        stack = []  # (level, path)

        for item in sorted(self.project_structure, key=lambda x: x['full_path']):
            level = item['level']

            # 调整栈
            while stack and stack[-1][0] >= level:
                stack.pop()

            # 生成缩进
            indent = ""
            parent_indent = ""

            if level > 0:
                for i in range(level):
                    if i < len(stack):
                        if stack[i][2]:  # 如果是最后一个
                            parent_indent += "    "
                        else:
                            parent_indent += "│   "

            # 判断是否是最后一个
            siblings = [i for i in self.project_structure
                        if i['level'] == level and i != item]
            is_last = not any(i['full_path'] > item['full_path'] for i in siblings)

            # 连接线
            connector = "└── " if is_last else "├── "

            # 图标
            icon = "📁 " if item['is_dir'] else "📄 "
            suffix = "/" if item['is_dir'] else ""

            preview_content += f"{parent_indent}{connector}{icon}{item['name']}{suffix}\n"

            # 添加到栈
            stack.append((level, item['full_path'], is_last))

        preview_content += "\n" + "=" * 60 + "\n"
        dir_count = len([i for i in self.project_structure if i['is_dir']])
        file_count = len([i for i in self.project_structure if not i['is_dir']])
        preview_content += f"总计: {dir_count} 个目录, {file_count} 个文件\n"

        # 插入预览内容
        self.preview_text.insert(1.0, preview_content)
        self.preview_text.config(state=tk.DISABLED)

        # 更新文件计数
        self.file_count_var.set(f"文件: {file_count}")

    def preview_structure(self):
        """预览完整结构"""
        if not self.project_structure:
            messagebox.showwarning("警告", "请先解析项目结构")
            return

        preview_window = tk.Toplevel(self.root)
        preview_window.title("完整结构预览")
        preview_window.geometry("900x700")

        # 标题
        title_frame = ttk.Frame(preview_window, relief="ridge", borderwidth=2)
        title_frame.pack(fill=tk.X, padx=10, pady=(10, 0))

        title_label = tk.Label(title_frame, text="📊 项目结构预览",
                               font=("Arial", 16, "bold"), fg="#2c3e50")
        title_label.pack(pady=10)

        # 预览区域
        preview_frame = ttk.Frame(preview_window, padding=10)
        preview_frame.pack(fill=tk.BOTH, expand=True)

        # 树形视图
        tree_frame = ttk.Frame(preview_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)

        # 创建Treeview
        columns = ("名称", "类型", "路径")
        tree = ttk.Treeview(tree_frame, columns=columns, show="tree headings", height=20)

        # 设置列
        tree.column("#0", width=200, minwidth=100)
        tree.column("名称", width=150, minwidth=100)
        tree.column("类型", width=80, minwidth=80)
        tree.column("路径", width=300, minwidth=200)

        # 设置标题
        tree.heading("#0", text="树状结构", anchor=tk.W)
        tree.heading("名称", text="名称", anchor=tk.W)
        tree.heading("类型", text="类型", anchor=tk.W)
        tree.heading("路径", text="路径", anchor=tk.W)

        # 滚动条
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        # 布局
        tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")

        tree_frame.grid_rowconfigure(0, weight=1)
        tree_frame.grid_columnconfigure(0, weight=1)

        # 添加数据到Treeview
        node_map = {}

        for item in sorted(self.project_structure, key=lambda x: x['full_path']):
            parent = ""
            if item['level'] > 0:
                # 查找父节点
                parent_parts = item['full_path'].split('/')[:-1]
                parent_path = '/'.join(parent_parts)
                parent = node_map.get(parent_path, "")

            node_type = "目录" if item['is_dir'] else "文件"
            node_id = tree.insert(parent, "end", text=item['name'],
                                  values=(item['name'], node_type, item['full_path']),
                                  open=True)

            node_map[item['full_path']] = node_id

        # 按钮区域
        button_frame = ttk.Frame(preview_window)
        button_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        close_btn = tk.Button(button_frame, text="关闭",
                              command=preview_window.destroy,
                              bg="#95a5a6", fg="white",
                              font=("Arial", 11, "bold"),
                              padx=20, pady=10)
        close_btn.pack()

    def copy_structure(self):
        """复制结构到剪贴板"""
        if not self.project_structure:
            messagebox.showwarning("警告", "没有可复制的结构")
            return

        try:
            import pyperclip
            preview_content = self.preview_text.get(1.0, tk.END).strip()
            pyperclip.copy(preview_content)
            self.set_status("结构已复制到剪贴板")
        except ImportError:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.preview_text.get(1.0, tk.END).strip())
            self.set_status("结构已复制到剪贴板")

    def export_structure(self):
        """导出结构到文件"""
        if not self.project_structure:
            messagebox.showwarning("警告", "没有可导出的结构")
            return

        filename = filedialog.asksaveasfilename(
            title="导出项目结构",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )

        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(self.preview_text.get(1.0, tk.END))
                self.set_status(f"结构已导出到: {filename}")
            except Exception as e:
                messagebox.showerror("导出错误", f"导出失败: {str(e)}")

    def clear_preview(self):
        """清空预览"""
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)
        self.preview_text.config(state=tk.DISABLED)
        self.file_count_var.set("文件: 0")

    def generate_project(self):
        """生成项目"""
        if not self.project_structure:
            messagebox.showwarning("警告", "请先解析项目结构")
            return

        target_dir = self.dir_var.get().strip()
        if not target_dir:
            messagebox.showwarning("警告", "请选择目标目录")
            return

        if not messagebox.askyesno("确认", f"将在以下目录创建项目:\n{target_dir}\n\n是否继续？"):
            return

        # 显示进度条
        self.show_progress("正在生成项目...")

        try:
            # 创建项目根目录
            project_path = Path(target_dir)
            if self.project_name:
                project_path = project_path / self.project_name

            project_path.mkdir(parents=True, exist_ok=True)

            # 开始生成
            self.set_status(f"开始生成项目: {self.project_name}")

            created_dirs = 0
            created_files = 0
            skipped = 0

            # 先创建所有目录
            for item in self.project_structure:
                if item['is_dir']:
                    dir_path = project_path / item['full_path']
                    try:
                        if not dir_path.exists():
                            dir_path.mkdir(parents=True, exist_ok=True)
                            created_dirs += 1
                    except Exception as e:
                        self.set_status(f"创建目录失败 {item['name']}: {str(e)}")

            # 再创建所有文件
            for item in self.project_structure:
                if not item['is_dir']:
                    file_path = project_path / item['full_path']
                    try:
                        # 确保父目录存在
                        file_path.parent.mkdir(parents=True, exist_ok=True)

                        if file_path.exists() and not self.overwrite_var.get():
                            skipped += 1
                            continue

                        if self.create_empty_var.get():
                            file_path.touch()
                        created_files += 1
                    except Exception as e:
                        self.set_status(f"创建文件失败 {item['name']}: {str(e)}")

            # 更新状态
            self.set_status(f"✅ 生成完成！目录: {created_dirs}, 文件: {created_files}")

            # 显示结果对话框
            result_text = f"✅ 项目生成完成！\n\n"
            result_text += f"📁 创建目录: {created_dirs} 个\n"
            result_text += f"📄 创建文件: {created_files} 个\n"
            result_text += f"⏭️  跳过项目: {skipped} 个\n"
            result_text += f"📍 项目位置: {project_path}"

            messagebox.showinfo("完成", result_text)

        except Exception as e:
            messagebox.showerror("错误", f"生成失败: {str(e)}")
            self.set_status(f"❌ 生成失败: {str(e)}")

        finally:
            # 隐藏进度条
            self.hide_progress()

    def show_progress(self, message):
        """显示进度条"""
        self.status_var.set(message)
        self.progress_bar.pack(side=tk.RIGHT, padx=10)
        self.progress_bar.start(10)

    def hide_progress(self):
        """隐藏进度条"""
        self.progress_bar.stop()
        self.progress_bar.pack_forget()

    def set_status(self, message):
        """设置状态消息"""
        self.status_var.set(message)

    def run(self):
        """运行应用"""
        # 居中显示窗口
        self.center_window()
        self.root.mainloop()

    def center_window(self):
        """将窗口居中显示"""
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')


def main():
    """主函数"""
    print("""
    ╔═══════════════════════════════════════════════╗
    ║       智能项目结构生成器 v5.0                 ║
    ║                                               ║
    ║  功能特点：                                    ║
    ║  ✅ 现代化自适应界面                          ║
    ║  ✅ 智能树状结构解析                          ║
    ║  ✅ 完整项目预览功能                          ║
    ║  ✅ 多种导出选项                              ║
    ║  ✅ 支持带注释的项目结构                      ║
    ╚═══════════════════════════════════════════════╝

    使用方法：
    1. 粘贴项目结构到左侧文本框
    2. 点击"解析结构"按钮
    3. 查看右侧预览结果
    4. 选择目标目录
    5. 点击"生成项目结构"按钮

    支持格式示例：
    project/
    ├── dir1/
    │   ├── file1.txt        # 注释
    │   └── subdir/
    ├── dir2/
    │   └── file2.py
    └── README.md
    """)

    app = ModernProjectGenerator()
    app.run()


if __name__ == "__main__":
    main()