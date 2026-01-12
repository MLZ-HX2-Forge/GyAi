<div align="center">

### 🚨 **<mark>重要提醒</mark>** 🚨

**⚠️ 本项目由大家共同维护，谨慎修改，避免破坏现有功能！**

**📋 在提交更改前，请确保你已经：**  
   1. 测试了你的修改   
   2. 与相关模块负责人沟通  

</div>


#### 第三方依赖导出说明
>大家将前后端搭建起来后说明一下自己所负责的那块区域使用了哪些第三方依赖，
> 以便于其他人拉取项目后下载对应的依赖运行项目，比如我的硬件相关HardWare文件下有一个requirements.txt文件中，就有需要使用的依赖以及对应版本

下面是导出依赖的方案：
#### 🗂️ 依赖配置文件结构
请将依赖信息存放在对应模块的 requirements.txt 文件中：
```
项目根目录/
├── Hardware/               # 硬件模块
│   └── requirements.txt    # 硬件端依赖配置文件
├── Backend/               # 后端模块
│   └── requirements.txt    # 后端依赖配置文件
├── Frontend/              # 前端模块
│   └── package.json       # 前端依赖配置文件
└── ...
```

##### 第一步：安装 pipreqs（使用清华镜像源加速）</br>
```
pip install pipreqs -i https://tuna.tsinghua.edu.cn/simple
```
##### 第二步：使用 pipreqs 导出依赖
```cd YourModule/```

##### 第三步：生成 requirements.txt 文件
```
pipreqs ./ --encoding=utf8 --force
```

##### pipreqs 参数说明  
- ./：指定当前目录为项目根目录  
- --encoding=utf8：使用UTF-8编码，避免中文路径问题  
- --force：强制覆盖已存在的 requirements.txt 文件  <br>















<!--华丽的分割线-->
---
___

<!--[] 复选框列表-->
<div align="center">

***相关教程链接***
|       ***相关链接***              |               *描述*             |
|:-------------------------------:|:--------------------------------:|
|  [√][MarkDown编写教程][mk]        |           如何编写MarkDown文件?    |
|  [√][人脸识别模型以及使用链接][face] |            如何进行人脸识别？        |    


</div>

<!--连接区域-->
[mk]:https://www.runoob.com/markdown/md-link.html
[face]:https://github.com/deepinsight/insightface





