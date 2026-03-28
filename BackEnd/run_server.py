# -*- coding: utf-8 -*-
"""
GyAI 工业智能助手 - 使用 waitress 启动（解决 Python 3.14 socket 问题）
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    print('=' * 60)
    print('GyAI 工业智能助手')
    print('=' * 60)
    print(f'服务地址: http://127.0.0.1:5000')
    print(f'主页面: http://127.0.0.1:5000/')
    print(f'对话页面: http://127.0.0.1:5000/chat')
    print('=' * 60)
    
    try:
        from waitress import serve
        print('使用 waitress WSGI 服务器启动...')
        serve(app, host='127.0.0.1', port=5000, threads=4)
    except ImportError:
        print('waitress 未安装，尝试使用 Flask 内置服务器...')
        print('注意：Python 3.14 可能存在兼容性问题，建议降级到 Python 3.11 或 3.12')
        app.run(host='127.0.0.1', port=5000, debug=True, threaded=True, use_reloader=False)
