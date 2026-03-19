# -*- coding: utf-8 -*-
"""
用户认证服务
支持用户注册、登录、游客模式
"""

import os
import json
import time
import sqlite3
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime
from contextlib import contextmanager
from config import Config
from utils.helpers import generate_id, generate_session_id, hash_password, verify_password

class AuthService:
    """用户认证服务"""
    
    def __init__(self):
        self.db_path = self._init_database()
    
    def _init_database(self) -> str:
        """初始化数据库"""
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        os.makedirs(data_dir, exist_ok=True)
        db_path = os.path.join(data_dir, 'gyai.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                nickname TEXT,
                avatar TEXT,
                is_guest INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login TEXT,
                settings TEXT DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT,
                model TEXT DEFAULT 'deepseek',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                images TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
        ''')
        
        conn.commit()
        conn.close()
        
        return db_path
    
    @contextmanager
    def _get_db(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def register(self, username: str, password: str, email: str = None, nickname: str = None) -> Dict[str, Any]:
        """用户注册"""
        if not username or not password:
            return {'success': False, 'message': '用户名和密码不能为空'}
        
        if len(username) < 3 or len(username) > 20:
            return {'success': False, 'message': '用户名长度需在3-20个字符之间'}
        
        if len(password) < 6:
            return {'success': False, 'message': '密码长度至少6个字符'}
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        user_id = generate_id()
        password_hash = hash_password(password)
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT INTO users (id, username, email, password_hash, nickname, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)''',
                    (user_id, username, email, password_hash, nickname or username, now, now)
                )
                conn.commit()
                
                return {
                    'success': True,
                    'message': '注册成功',
                    'user': {
                        'id': user_id,
                        'username': username,
                        'email': email,
                        'nickname': nickname or username
                    }
                }
        except sqlite3.IntegrityError as e:
            if 'username' in str(e):
                return {'success': False, 'message': '用户名已存在'}
            elif 'email' in str(e):
                return {'success': False, 'message': '邮箱已被注册'}
            return {'success': False, 'message': '注册失败'}
        except Exception as e:
            return {'success': False, 'message': f'注册失败: {str(e)}'}
    
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """用户登录"""
        if not username or not password:
            return {'success': False, 'message': '用户名和密码不能为空'}
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT * FROM users WHERE username = ? AND is_guest = 0',
                    (username,)
                )
                user = cursor.fetchone()
                
                if not user:
                    return {'success': False, 'message': '用户不存在'}
                
                if not verify_password(password, user['password_hash']):
                    return {'success': False, 'message': '密码错误'}
                
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute(
                    'UPDATE users SET last_login = ? WHERE id = ?',
                    (now, user['id'])
                )
                
                token = generate_session_id()
                expires_at = datetime.now().timestamp() + Config.SESSION_CONFIG['max_age']
                expires_at_str = datetime.fromtimestamp(expires_at).strftime('%Y-%m-%d %H:%M:%S')
                
                cursor.execute(
                    '''INSERT INTO sessions (id, user_id, token, created_at, expires_at)
                       VALUES (?, ?, ?, ?, ?)''',
                    (generate_id(), user['id'], token, now, expires_at_str)
                )
                
                conn.commit()
                
                return {
                    'success': True,
                    'message': '登录成功',
                    'token': token,
                    'user': {
                        'id': user['id'],
                        'username': user['username'],
                        'email': user['email'],
                        'nickname': user['nickname'],
                        'avatar': user['avatar']
                    }
                }
        except Exception as e:
            return {'success': False, 'message': f'登录失败: {str(e)}'}
    
    def create_guest(self) -> Dict[str, Any]:
        """创建游客账户"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        guest_id = generate_id()
        guest_name = f'guest_{guest_id[:8]}'
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT INTO users (id, username, nickname, is_guest, created_at, updated_at)
                       VALUES (?, ?, ?, 1, ?, ?)''',
                    (guest_id, guest_name, '游客用户', now, now)
                )
                
                token = generate_session_id()
                expires_at = datetime.now().timestamp() + Config.SESSION_CONFIG['max_age']
                expires_at_str = datetime.fromtimestamp(expires_at).strftime('%Y-%m-%d %H:%M:%S')
                
                cursor.execute(
                    '''INSERT INTO sessions (id, user_id, token, created_at, expires_at)
                       VALUES (?, ?, ?, ?, ?)''',
                    (generate_id(), guest_id, token, now, expires_at_str)
                )
                
                conn.commit()
                
                return {
                    'success': True,
                    'token': token,
                    'user': {
                        'id': guest_id,
                        'username': guest_name,
                        'nickname': '游客用户',
                        'is_guest': True
                    }
                }
        except Exception as e:
            return {'success': False, 'message': f'创建游客失败: {str(e)}'}
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """验证Token"""
        if not token:
            return None
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                cursor.execute(
                    '''SELECT s.*, u.username, u.email, u.nickname, u.avatar, u.is_guest, u.settings
                       FROM sessions s
                       JOIN users u ON s.user_id = u.id
                       WHERE s.token = ? AND s.is_active = 1 AND s.expires_at > ?''',
                    (token, now)
                )
                session = cursor.fetchone()
                
                if not session:
                    return None
                
                return {
                    'id': session['user_id'],
                    'username': session['username'],
                    'email': session['email'],
                    'nickname': session['nickname'],
                    'avatar': session['avatar'],
                    'is_guest': bool(session['is_guest']),
                    'settings': json.loads(session['settings'] or '{}')
                }
        except Exception:
            return None
    
    def logout(self, token: str) -> bool:
        """登出"""
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'UPDATE sessions SET is_active = 0 WHERE token = ?',
                    (token,)
                )
                conn.commit()
                return True
        except Exception:
            return False
    
    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户信息"""
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT id, username, email, nickname, avatar, is_guest, settings, created_at FROM users WHERE id = ?',
                    (user_id,)
                )
                user = cursor.fetchone()
                
                if not user:
                    return None
                
                return {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'nickname': user['nickname'],
                    'avatar': user['avatar'],
                    'is_guest': bool(user['is_guest']),
                    'settings': json.loads(user['settings'] or '{}'),
                    'created_at': user['created_at']
                }
        except Exception:
            return None
    
    def update_user(self, user_id: str, **kwargs) -> Dict[str, Any]:
        """更新用户信息"""
        allowed_fields = ['nickname', 'avatar', 'settings']
        updates = {}
        
        for field in allowed_fields:
            if field in kwargs:
                if field == 'settings':
                    updates[field] = json.dumps(kwargs[field], ensure_ascii=False)
                else:
                    updates[field] = kwargs[field]
        
        if not updates:
            return {'success': False, 'message': '没有可更新的字段'}
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        updates['updated_at'] = now
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                set_clause = ', '.join([f'{k} = ?' for k in updates.keys()])
                values = list(updates.values()) + [user_id]
                
                cursor.execute(
                    f'UPDATE users SET {set_clause} WHERE id = ?',
                    values
                )
                conn.commit()
                
                return {'success': True, 'message': '更新成功'}
        except Exception as e:
            return {'success': False, 'message': f'更新失败: {str(e)}'}

auth_service = AuthService()
