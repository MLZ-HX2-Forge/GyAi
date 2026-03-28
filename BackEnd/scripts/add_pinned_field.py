# -*- coding: utf-8 -*-
"""
数据库迁移脚本：为 conversations 表添加 pinned 字段
"""

import sqlite3
import os

def add_pinned_field():
    """为 conversations 表添加 pinned 字段"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gyai.db')
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在：{db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'pinned' in columns:
            print("pinned 字段已存在，无需迁移")
            conn.close()
            return
        
        # 添加 pinned 字段
        cursor.execute('''
            ALTER TABLE conversations 
            ADD COLUMN pinned INTEGER DEFAULT 0
        ''')
        
        conn.commit()
        print("成功添加 pinned 字段")
        
    except Exception as e:
        print(f"迁移失败：{e}")
    finally:
        conn.close()

if __name__ == '__main__':
    add_pinned_field()
