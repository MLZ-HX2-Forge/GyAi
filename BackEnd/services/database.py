# -*- coding: utf-8 -*-
"""
数据库管理模块
支持MySQL和SQLite的统一接口
"""

import os
import json
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime
from contextlib import contextmanager
from config import Config

try:
    import pymysql
    from pymysql.cursors import DictCursor
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False


class DatabaseManager:
    """数据库管理器"""

    def __init__(self):
        self.db_type = getattr(Config, 'DATABASE_TYPE', 'sqlite')
        
        if self.db_type == 'mysql' and MYSQL_AVAILABLE:
            self.mysql_config = getattr(Config, 'MYSQL_CONFIG', {})
            self._init_mysql()
        else:
            self.db_type = 'sqlite'
            self._init_sqlite()

    def _init_mysql(self):
        """初始化MySQL配置"""
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

    def _init_sqlite(self):
        """初始化SQLite配置"""
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        os.makedirs(data_dir, exist_ok=True)
        self.sqlite_path = os.path.join(data_dir, 'gyai.db')

    @contextmanager
    def get_connection(self):
        """获取数据库连接"""
        if self.db_type == 'mysql':
            connection = pymysql.connect(**self.mysql_config)
        else:
            connection = sqlite3.connect(self.sqlite_path)
            connection.row_factory = sqlite3.Row
        
        try:
            yield connection
        finally:
            connection.close()

    def execute(self, query: str, params: tuple = None) -> int:
        """执行SQL语句"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if self.db_type == 'sqlite':
                conn.commit()
            
            return cursor.rowcount

    def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """批量执行SQL语句"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(query, params_list)
            
            if self.db_type == 'sqlite':
                conn.commit()
            
            return cursor.rowcount

    def fetch_one(self, query: str, params: tuple = None) -> Optional[Dict]:
        """查询单条记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            row = cursor.fetchone()
            if row:
                if self.db_type == 'mysql':
                    return row
                else:
                    return dict(row)
            return None

    def fetch_all(self, query: str, params: tuple = None) -> List[Dict]:
        """查询多条记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            rows = cursor.fetchall()
            if self.db_type == 'mysql':
                return rows
            else:
                return [dict(row) for row in rows]

    def insert(self, table: str, data: Dict[str, Any]) -> str:
        """插入记录"""
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['%s'] * len(data)) if self.db_type == 'mysql' else ', '.join(['?'] * len(data))
        values = tuple(self._serialize_value(v) for v in data.values())
        
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, values)
            
            if self.db_type == 'sqlite':
                conn.commit()
            
            return data.get('id') or str(cursor.lastrowid)

    def update(self, table: str, data: Dict[str, Any], where: str, where_params: tuple = None) -> int:
        """更新记录"""
        set_clause = ', '.join([f"{k} = %s" for k in data.keys()]) if self.db_type == 'mysql' else ', '.join([f"{k} = ?" for k in data.keys()])
        values = tuple(self._serialize_value(v) for v in data.values())
        
        query = f"UPDATE {table} SET {set_clause} WHERE {where}"
        
        if where_params:
            values = values + (where_params if isinstance(where_params, tuple) else (where_params,))
        
        return self.execute(query, values)

    def delete(self, table: str, where: str, params: tuple = None) -> int:
        """删除记录"""
        query = f"DELETE FROM {table} WHERE {where}"
        return self.execute(query, params)

    def _serialize_value(self, value: Any) -> Any:
        """序列化值"""
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return value

    def _deserialize_value(self, value: Any) -> Any:
        """反序列化值"""
        if isinstance(value, str) and (value.startswith('{') or value.startswith('[')):
            try:
                return json.loads(value)
            except:
                pass
        return value


db_manager = DatabaseManager()
