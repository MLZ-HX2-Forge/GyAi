# -*- coding: utf-8 -*-
"""
工具函数模块
提供通用工具函数
"""

import json
import time
import uuid
import hashlib
from datetime import datetime
from functools import wraps
from flask import request, jsonify, g

def generate_id():
    """生成唯一ID"""
    return str(uuid.uuid4())

def generate_session_id():
    """生成会话ID"""
    timestamp = str(time.time()).encode('utf-8')
    random_bytes = uuid.uuid4().bytes
    return hashlib.sha256(timestamp + random_bytes).hexdigest()[:32]

def format_timestamp(timestamp=None):
    """格式化时间戳"""
    if timestamp is None:
        timestamp = time.time()
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def hash_password(password):
    """密码哈希"""
    salt = 'gyai_industrial_salt_2024'
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_password(password, hashed):
    """验证密码"""
    return hash_password(password) == hashed

def sanitize_input(text):
    """清理输入文本"""
    if not text:
        return ''
    text = text.strip()
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    return text

def truncate_text(text, max_length=100):
    """截断文本"""
    if not text:
        return ''
    if len(text) <= max_length:
        return text
    return text[:max_length] + '...'

def build_chat_history(messages, max_length=50):
    """构建对话历史"""
    history = []
    for msg in messages[-max_length:]:
        if isinstance(msg, dict):
            history.append({
                'role': msg.get('role', 'user'),
                'content': msg.get('content', '')
            })
    return history

def format_sse_data(data):
    """格式化SSE数据"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

def format_sse_done():
    """格式化SSE结束标记"""
    return "data: [DONE]\n\n"

def require_auth(f):
    """认证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        from services.auth_service import AuthService
        token = request.headers.get('Authorization')
        if not token:
            token = request.cookies.get('gyai_session')
        
        if token:
            if token.startswith('Bearer '):
                token = token[7:]
            
            user = AuthService.verify_token(token)
            if user:
                g.current_user = user
                return f(*args, **kwargs)
        
        g.current_user = None
        g.is_guest = True
        return f(*args, **kwargs)
    return decorated

def guest_allowed(f):
    """允许游客访问装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        g.is_guest = not hasattr(g, 'current_user') or g.current_user is None
        return f(*args, **kwargs)
    return decorated

class ResponseBuilder:
    """响应构建器"""
    
    @staticmethod
    def success(data=None, message='操作成功'):
        return jsonify({
            'code': 200,
            'message': message,
            'data': data,
            'timestamp': format_timestamp()
        })
    
    @staticmethod
    def error(code=500, message='操作失败', data=None):
        return jsonify({
            'code': code,
            'message': message,
            'data': data,
            'timestamp': format_timestamp()
        }), code if code >= 400 else 500
    
    @staticmethod
    def paginated(data, page, page_size, total):
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'list': data,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total,
                    'total_pages': (total + page_size - 1) // page_size
                }
            },
            'timestamp': format_timestamp()
        })
