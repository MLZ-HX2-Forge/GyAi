大家将前后端搭建起来后说明一下自己所负责的那块区域使用了哪些第三方依赖，以便于其他人拉取项目后下载对应的依赖运行项目，比如我的HardWare文件下有一个requirements.txt文件中，就有需要使用的依赖以及对应版本
下面是导出依赖的方案：
🗂️ 依赖配置文件结构
请将依赖信息存放在对应模块的 requirements.txt 文件中：

text
项目根目录/
├── Hardware/               # 硬件模块
│   └── requirements.txt    # 硬件端依赖配置文件
├── Backend/               # 后端模块
│   └── requirements.txt    # 后端依赖配置文件
├── Frontend/              # 前端模块
│   └── package.json       # 前端依赖配置文件
└── ...

🔧 推荐依赖导出方法
第一步：安装 pipreqs（使用清华镜像源加速）

text
pip install pipreqs -i https://tuna.tsinghua.edu.cn/simple
第二步：使用 pipreqs 导出依赖
进入你的项目模块目录

text
cd 你的项目目录/
第三步：生成 requirements.txt 文件

text
pipreqs ./ --encoding=utf8 --force
pipreqs 参数说明

text
./：指定当前目录为项目根目录
--encoding=utf8：使用UTF-8编码，避免中文路径问题
--force：强制覆盖已存在的 requirements.txt 文件
