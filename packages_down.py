#!/usr/bin/env python3
"""
清华源快速安装Python包
用法：直接运行，修改packages列表即可
"""

import subprocess
import sys

# 在这里修改你要安装的包
PACKAGES = [

       "pandas",
       "opencv-python"

]

# 清华镜像源
MIRROR = "https://pypi.tuna.tsinghua.edu.cn/simple"

if __name__ == "__main__":
    print(f"使用清华源安装 {len(PACKAGES)} 个包...")

    # 尝试批量安装
    try:
        subprocess.run([
            sys.executable, "-m", "pip", "install",
            "-i", MIRROR,
            "--trusted-host", "pypi.tuna.tsinghua.edu.cn",
            *PACKAGES
        ], check=True)
        print("✅ 安装成功!")

    except subprocess.CalledProcessError:
        print("⚠️  批量安装失败，尝试逐个安装...")

        for pkg in PACKAGES:
            try:
                subprocess.run([
                    sys.executable, "-m", "pip", "install",
                    "-i", MIRROR,
                    "--trusted-host", "pypi.tuna.tsinghua.edu.cn",
                    pkg
                ], check=True)
                print(f"  ✅ {pkg}")
            except:
                print(f"  ❌ {pkg}")