# -*- coding: utf-8 -*-
"""
对话服务
管理对话历史和消息存储
"""

import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import contextmanager
from utils.helpers import generate_id

class ConversationService:
    """对话服务"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    @contextmanager
    def _get_db(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def create_conversation(self, user_id: str, title: str = '新对话', model: str = 'deepseek') -> Dict[str, Any]:
        """创建新对话"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conv_id = generate_id()
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?)''',
                    (conv_id, user_id, title, model, now, now)
                )
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
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''SELECT id, title, model, created_at, updated_at
                       FROM conversations
                       WHERE user_id = ? AND is_deleted = 0
                       ORDER BY updated_at DESC
                       LIMIT ? OFFSET ?''',
                    (user_id, page_size, offset)
                )
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception:
            return []
    
    def get_conversation(self, conv_id: str) -> Optional[Dict]:
        """获取单个对话"""
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''SELECT id, user_id, title, model, created_at, updated_at
                       FROM conversations
                       WHERE id = ? AND is_deleted = 0''',
                    (conv_id,)
                )
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception:
            return None
    
    def update_conversation(self, conv_id: str, **kwargs) -> bool:
        """更新对话"""
        allowed_fields = ['title', 'model']
        updates = {}
        
        for field in allowed_fields:
            if field in kwargs:
                updates[field] = kwargs[field]
        
        if not updates:
            return False
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        updates['updated_at'] = now
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                set_clause = ', '.join([f'{k} = ?' for k in updates.keys()])
                values = list(updates.values()) + [conv_id]
                
                cursor.execute(
                    f'UPDATE conversations SET {set_clause} WHERE id = ?',
                    values
                )
                conn.commit()
                return True
        except Exception:
            return False
    
    def delete_conversation(self, conv_id: str) -> bool:
        """删除对话（软删除）"""
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute(
                    'UPDATE conversations SET is_deleted = 1, updated_at = ? WHERE id = ?',
                    (now, conv_id)
                )
                conn.commit()
                return True
        except Exception:
            return False
    
    def add_message(self, conv_id: str, role: str, content: str, images: List[str] = None) -> Dict[str, Any]:
        """添加消息"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        msg_id = generate_id()
        images_json = json.dumps(images, ensure_ascii=False) if images else None
        
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT INTO messages (id, conversation_id, role, content, images, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)''',
                    (msg_id, conv_id, role, content, images_json, now)
                )
                
                cursor.execute(
                    'UPDATE conversations SET updated_at = ? WHERE id = ?',
                    (now, conv_id)
                )
                
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
        try:
            with self._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''SELECT id, role, content, images, created_at
                       FROM messages
                       WHERE conversation_id = ?
                       ORDER BY created_at ASC
                       LIMIT ?''',
                    (conv_id, limit)
                )
                
                messages = []
                for row in cursor.fetchall():
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

from config import Config
import os
db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'gyai.db')
conversation_service = ConversationService(db_path)
