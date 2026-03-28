# -*- coding: utf-8 -*-
"""
GyAI 工业智能助手 - 替代启动脚本
使用内置 HTTP 服务器绕过 socket 问题
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print('=' * 60)
print('GyAI 工业智能助手 - 替代启动模式')
print('=' * 60)

try:
    from http.server import HTTPServer, SimpleHTTPRequestHandler
    from urllib.parse import urlparse, parse_qs
    import json
    import threading
    import time
    
    class GyAIRequestHandler(SimpleHTTPRequestHandler):
        """自定义请求处理器"""
        
        def __init__(self, *args, **kwargs):
            self.directory = os.path.join(os.path.dirname(__file__), '..', 'FrontEnd')
            super().__init__(*args, directory=self.directory, **kwargs)
        
        def do_GET(self):
            parsed_path = urlparse(self.path)
            
            if parsed_path.path == '/' or parsed_path.path == '':
                self.serve_file('html/index.html')
            elif parsed_path.path == '/chat':
                self.serve_file('html/chat.html')
            elif parsed_path.path == '/api/health':
                self.send_json_response({'status': 'healthy', 'service': 'GyAI'})
            else:
                super().do_GET()
        
        def do_POST(self):
            parsed_path = urlparse(self.path)
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
            
            try:
                data = json.loads(body) if body else {}
            except json.JSONDecodeError:
                data = {}
            
            if parsed_path.path == '/api/chat/stream':
                self.handle_chat_stream(data)
            elif parsed_path.path == '/api/chat/sync':
                self.handle_chat_sync(data)
            elif parsed_path.path == '/api/auth/login':
                self.handle_auth_login(data)
            elif parsed_path.path == '/api/auth/guest':
                self.handle_auth_guest()
            elif parsed_path.path == '/api/auth/register':
                self.handle_auth_register(data)
            else:
                self.send_error_response(404, '接口不存在')
        
        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.end_headers()
        
        def serve_file(self, relative_path):
            file_path = os.path.join(self.directory, relative_path)
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(file_path))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error_response(404, '文件不存在')
        
        def send_json_response(self, data, status=200):
            response = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Content-Length', len(response))
            self.end_headers()
            self.wfile.write(response)
        
        def send_error_response(self, code, message):
            self.send_json_response({'code': code, 'message': message}, code)
        
        def handle_chat_stream(self, data):
            try:
                from services.llm_service import llm_service
                
                message = data.get('message', '')
                model = data.get('model', 'deepseek')
                history = data.get('history', [])
                images = data.get('images', [])
                
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                for chunk in llm_service.chat_stream(message, model, history, images):
                    if chunk.get('content'):
                        event_data = f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                        self.wfile.write(event_data.encode('utf-8'))
                        self.wfile.flush()
                
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
                
            except Exception as e:
                self.send_error_response(500, str(e))
        
        def handle_chat_sync(self, data):
            try:
                from services.llm_service import llm_service
                
                message = data.get('message', '')
                model = data.get('model', 'deepseek')
                history = data.get('history', [])
                images = data.get('images', [])
                
                result = llm_service.chat_sync(message, model, history, images)
                self.send_json_response(result)
                
            except Exception as e:
                self.send_error_response(500, str(e))
        
        def handle_auth_login(self, data):
            username = data.get('username', '')
            password = data.get('password', '')
            
            if username and password:
                self.send_json_response({
                    'code': 200,
                    'message': '登录成功',
                    'data': {
                        'user_id': '1',
                        'username': username,
                        'nickname': username,
                        'token': 'demo_token_' + str(int(time.time()))
                    }
                })
            else:
                self.send_error_response(400, '用户名和密码不能为空')
        
        def handle_auth_guest(self):
            self.send_json_response({
                'code': 200,
                'message': '访客登录成功',
                'data': {
                    'user_id': 'guest',
                    'username': 'guest',
                    'nickname': '访客用户',
                    'token': 'guest_token_' + str(int(time.time()))
                }
            })
        
        def handle_auth_register(self, data):
            username = data.get('username', '')
            password = data.get('password', '')
            
            if username and password:
                self.send_json_response({
                    'code': 200,
                    'message': '注册成功',
                    'data': {
                        'user_id': 'new_' + str(int(time.time())),
                        'username': username,
                        'nickname': username
                    }
                })
            else:
                self.send_error_response(400, '用户名和密码不能为空')
        
        def log_message(self, format, *args):
            pass
    
    PORT = 5000
    server_address = ('127.0.0.1', PORT)
    
    print(f'尝试启动服务器在端口 {PORT}...')
    
    try:
        httpd = HTTPServer(server_address, GyAIRequestHandler)
        print(f'服务地址: http://127.0.0.1:{PORT}')
        print(f'主页面: http://127.0.0.1:{PORT}/')
        print(f'对话页面: http://127.0.0.1:{PORT}/chat')
        print('=' * 60)
        print('服务器启动成功! 按 Ctrl+C 停止服务器')
        print('=' * 60)
        httpd.serve_forever()
    except OSError as e:
        if e.winerror == 10022:
            print('\n' + '=' * 60)
            print('错误: Windows Socket 系统问题')
            print('=' * 60)
            print('\n您的系统存在 Windows Socket 问题，需要修复:')
            print('\n解决方案:')
            print('1. 以管理员身份打开 PowerShell')
            print('2. 运行命令: netsh winsock reset')
            print('3. 重启电脑')
            print('4. 重新启动此程序')
            print('\n如果问题仍然存在，请尝试:')
            print('1. 完全卸载所有 Python 版本')
            print('2. 删除以下目录:')
            print('   - C:\\Users\\lqyq1\\AppData\\Local\\Programs\\Python')
            print('3. 重新安装 Python 3.11')
            print('4. 安装依赖: pip install flask flask-cors requests')
        else:
            print(f'\n启动失败: {e}')
    
except ImportError as e:
    print(f'\n缺少依赖: {e}')
    print('请安装所需依赖: pip install flask flask-cors requests')
except Exception as e:
    print(f'\n启动失败: {e}')
