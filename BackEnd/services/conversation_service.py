# -*- coding: utf-8 -*-
"""
对话服务
管理对话历史和消息存储
支持MySQL和SQLite
"""

import os
import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import contextmanager
from utils.helpers import generate_id
from config import Config

try:
    import pymysql
    from pymysql.cursors import DictCursor
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False


class ConversationService:
    """对话服务"""

    def __init__(self):
        self.db_type = getattr(Config, 'DATABASE_TYPE', 'sqlite')
        
        if self.db_type == 'mysql' and MYSQL_AVAILABLE:
            self.mysql_config = getattr(Config, 'MYSQL_CONFIG', {})
            self._init_mysql()
        else:
            self.db_type = 'sqlite'
            self.db_path = self._init_sqlite()

    def _init_mysql(self):
        """初始化MySQL连接配置"""
        self.mysql_config = {
            'host': self.mysql_config.get('host', 'localhost'),
            'port': self.mysql_config.get('port', 3306),
            'user': self.mysql_config.get('user', 'root'),
            'password': self.mysql_config.get('password', '123456'),
            'database': self.mysql_config.get('database', 'gyai_db'),
            'charset': self.mysql_config.get('charset', 'utf8mb4'),
            'cursorclass': DictCursor,
            'autocommit': True
        }

    def _init_sqlite(self) -> str:
        """初始化SQLite数据库路径"""
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, 'gyai.db')

    @contextmanager
    def _get_db(self):
        """获取数据库连接"""
        if self.db_type == 'mysql':
            conn = pymysql.connect(**self.mysql_config)
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _get_placeholder(self):
        """获取占位符"""
        return '%s' if self.db_type == 'mysql' else '?'

    def create_conversation(self, user_id: str, title: str = '新对话', model: str = 'deepseek') -> Dict[str, Any]:
        """创建新对话"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conv_id = generate_id()
        ph = self._get_placeholder()

        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'''INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
                       VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})''',
                    (conv_id, user_id, title, model, now, now)
                )
                
                if self.db_type == 'sqlite':
                    conn.commit()

                return {
                    'id': conv_id,
                    'user_id': user_id,
                    'title': title,
                    'model': model,
                    'created_at': now,
                    'updated_at': now
                }
        except Exception as e:
            return {'error': str(e)}

    def get_conversations(self, user_id: str, page: int = 1, page_size: int = 20) -> List[Dict]:
        """获取用户的对话列表"""
        offset = (page - 1) * page_size
        ph = self._get_placeholder()

        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'''SELECT id, title, model, pinned, created_at, updated_at
                       FROM conversations
                       WHERE user_id = {ph} AND is_deleted = 0
                       ORDER BY pinned DESC, updated_at DESC
                       LIMIT {ph} OFFSET {ph}''',
                    (user_id, page_size, offset)
                )

                rows = cursor.fetchall()
                if self.db_type == 'mysql':
                    return [dict(row) for row in rows]
                else:
                    return [dict(row) for row in rows]
        except Exception:
            return []

    def get_conversation(self, conv_id: str) -> Optional[Dict]:
        """获取单个对话"""
        ph = self._get_placeholder()
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'''SELECT id, user_id, title, model, pinned, created_at, updated_at
                       FROM conversations
                       WHERE id = {ph} AND is_deleted = 0''',
                    (conv_id,)
                )
                row = cursor.fetchone()
                
                if row:
                    if self.db_type == 'mysql':
                        return dict(row)
                    else:
                        return dict(row)
                return None
        except Exception:
            return None

    def update_conversation(self, conv_id: str, **kwargs) -> bool:
        """更新对话"""
        allowed_fields = ['title', 'model', 'pinned']
        updates = {}

        for field in allowed_fields:
            if field in kwargs:
                updates[field] = kwargs[field]

        if not updates:
            return False

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        updates['updated_at'] = now

        ph = self._get_placeholder()
        set_clause = ', '.join([f'{k} = {ph}' for k in updates.keys()])
        values = list(updates.values()) + [conv_id]

        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'UPDATE conversations SET {set_clause} WHERE id = {ph}',
                    values
                )
                if self.db_type == 'sqlite':
                    conn.commit()
                return True
        except Exception:
            return False

    def delete_conversation(self, conv_id: str) -> bool:
        """删除对话（软删除）"""
        ph = self._get_placeholder()
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute(
                    f'UPDATE conversations SET is_deleted = 1, updated_at = {ph} WHERE id = {ph}',
                    (now, conv_id)
                )
                if self.db_type == 'sqlite':
                    conn.commit()
                return True
        except Exception:
            return False

    def add_message(self, conv_id: str, role: str, content: str, images: List[str] = None) -> Dict[str, Any]:
        """添加消息"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        msg_id = generate_id()
        images_json = json.dumps(images, ensure_ascii=False) if images else None
        ph = self._get_placeholder()

        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'''INSERT INTO messages (id, conversation_id, role, content, images, created_at)
                       VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})''',
                    (msg_id, conv_id, role, content, images_json, now)
                )

                cursor.execute(
                    f'UPDATE conversations SET updated_at = {ph} WHERE id = {ph}',
                    (now, conv_id)
                )

                if self.db_type == 'sqlite':
                    conn.commit()

                return {
                    'id': msg_id,
                    'conversation_id': conv_id,
                    'role': role,
                    'content': content,
                    'images': images,
                    'created_at': now
                }
        except Exception as e:
            return {'error': str(e)}

    def get_messages(self, conv_id: str, limit: int = 100) -> List[Dict]:
        """获取对话消息"""
        ph = self._get_placeholder()
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f'''SELECT id, role, content, images, created_at
                       FROM messages
                       WHERE conversation_id = {ph}
                       ORDER BY created_at ASC
                       LIMIT {ph}''',
                    (conv_id, limit)
                )

                rows = cursor.fetchall()
                messages = []
                for row in rows:
                    if self.db_type == 'mysql':
                        msg = dict(row)
                    else:
                        msg = dict(row)
                    if msg['images']:
                        msg['images'] = json.loads(msg['images'])
                    messages.append(msg)

                return messages
        except Exception:
            return []

    def get_history_for_llm(self, conv_id: str, limit: int = 50) -> List[Dict]:
        """获取用于LLM的对话历史"""
        messages = self.get_messages(conv_id, limit)
        return [
            {'role': msg['role'], 'content': msg['content']}
            for msg in messages
        ]


conversation_service = ConversationService()
