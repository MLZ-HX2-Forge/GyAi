# -*- coding: utf-8 -*-
"""
GyAI 系统诊断工具
用于诊断和修复 Python 环境问题
"""

import sys
import os

print('=' * 60)
print('GyAI 系统诊断工具')
print('=' * 60)

print(f'\nPython 版本: {sys.version}')
print(f'Python 路径: {sys.executable}')
print(f'工作目录: {os.getcwd()}')

print('\n' + '-' * 60)
print('模块测试:')
print('-' * 60)

modules_to_test = [
    ('sys', '系统模块'),
    ('os', '操作系统模块'),
    ('json', 'JSON模块'),
    ('time', '时间模块'),
    ('datetime', '日期时间模块'),
    ('threading', '线程模块'),
    ('_socket', '底层Socket模块'),
    ('socket', 'Socket模块'),
    ('asyncio', '异步IO模块'),
    ('_overlapped', 'Windows异步IO模块'),
    ('flask', 'Flask框架'),
    ('flask_cors', 'Flask CORS'),
    ('requests', 'HTTP请求库'),
]

failed_modules = []

for module_name, description in modules_to_test:
    try:
        __import__(module_name)
        print(f'  ✓ {module_name} ({description})')
    except Exception as e:
        print(f'  ✗ {module_name} ({description}) - 错误: {e}')
        failed_modules.append((module_name, str(e)))

print('\n' + '-' * 60)
print('Socket 功能测试:')
print('-' * 60)

try:
    import _socket
    print('  ✓ _socket 模块加载成功')
    
    try:
        s = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        print('  ✓ Socket 创建成功')
        s.close()
        print('  ✓ Socket 关闭成功')
    except Exception as e:
        print(f'  ✗ Socket 操作失败: {e}')
except Exception as e:
    print(f'  ✗ _socket 模块加载失败: {e}')

print('\n' + '-' * 60)
print('诊断结果:')
print('-' * 60)

if failed_modules:
    print('\n发现以下问题:')
    for module, error in failed_modules:
        print(f'  - {module}: {error}')
    
    if any('socket' in m[0].lower() or 'overlapped' in m[0].lower() for m in failed_modules):
        print('\n' + '=' * 60)
        print('检测到 Windows Socket 问题!')
        print('=' * 60)
        print('\n解决方案:')
        print('1. 以管理员身份打开 PowerShell')
        print('2. 运行命令: netsh winsock reset')
        print('3. 重启电脑')
        print('4. 重新运行此诊断脚本验证修复')
        print('\n如果问题仍然存在，请尝试:')
        print('1. 完全卸载所有 Python 版本')
        print('2. 删除 Python 安装目录')
        print('3. 重新安装 Python 3.11')
else:
    print('\n所有模块测试通过，系统状态正常!')

print('\n' + '=' * 60)
print('诊断完成')
print('=' * 60)
