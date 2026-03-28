# -*- coding: utf-8 -*-
"""
数据库初始化脚本
自动创建数据库和表结构
"""

import pymysql
from pymysql import Error
from config import Config


class DatabaseInitializer:
    """数据库初始化器"""

    def __init__(self):
        self.mysql_config = getattr(Config, 'MYSQL_CONFIG', {})
        self.host = self.mysql_config.get('host', 'localhost')
        self.port = self.mysql_config.get('port', 3306)
        self.user = self.mysql_config.get('user', 'root')
        self.password = self.mysql_config.get('password', '123456')
        self.database = self.mysql_config.get('database', 'gyai_db')
        self.charset = self.mysql_config.get('charset', 'utf8mb4')

    def get_connection(self, database=None):
        """获取数据库连接"""
        try:
            connection = pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=database,
                charset=self.charset,
                cursorclass=pymysql.cursors.DictCursor
            )
            return connection
        except Error as e:
            print(f'[数据库] 连接失败: {e}')
            return None

    def database_exists(self):
        """检查数据库是否存在"""
        try:
            connection = self.get_connection()
            if not connection:
                return False

            cursor = connection.cursor()
            cursor.execute(
                "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s",
                (self.database,)
            )
            result = cursor.fetchone()
            cursor.close()
            connection.close()

            return result is not None
        except Error as e:
            print(f'[数据库] 检查数据库存在失败: {e}')
            return False

    def create_database(self):
        """创建数据库"""
        try:
            connection = self.get_connection()
            if not connection:
                return False

            cursor = connection.cursor()
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{self.database}` "
                f"DEFAULT CHARACTER SET {self.charset} "
                f"DEFAULT COLLATE {self.charset}_unicode_ci"
            )
            cursor.close()
            connection.close()

            print(f'[数据库] 数据库 {self.database} 创建成功')
            return True
        except Error as e:
            print(f'[数据库] 创建数据库失败: {e}')
            return False

    def create_tables(self):
        """创建数据表"""
        connection = self.get_connection(self.database)
        if not connection:
            return False

        try:
            cursor = connection.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE,
                    password_hash VARCHAR(128) NOT NULL,
                    nickname VARCHAR(50),
                    avatar VARCHAR(255),
                    is_guest TINYINT DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_login DATETIME,
                    settings JSON DEFAULT NULL,
                    INDEX idx_username (username),
                    INDEX idx_email (email),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    token VARCHAR(64) UNIQUE NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    is_active TINYINT DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_token (token),
                    INDEX idx_expires_at (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversations (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    title VARCHAR(255),
                    model VARCHAR(50) DEFAULT 'deepseek',
                    pinned TINYINT DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    is_deleted TINYINT DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_updated_at (updated_at),
                    INDEX idx_pinned (pinned)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id VARCHAR(36) PRIMARY KEY,
                    conversation_id VARCHAR(36) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    content LONGTEXT NOT NULL,
                    images JSON DEFAULT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                    INDEX idx_conversation_id (conversation_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(36) UNIQUE,
                    setting_key VARCHAR(100) NOT NULL,
                    setting_value JSON DEFAULT NULL,
                    description VARCHAR(255),
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY uk_user_key (user_id, setting_key),
                    INDEX idx_user_id (user_id),
                    INDEX idx_setting_key (setting_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_config (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    config_key VARCHAR(100) UNIQUE NOT NULL,
                    config_value JSON DEFAULT NULL,
                    description VARCHAR(255),
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_config_key (config_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')

            connection.commit()
            print('[数据库] 数据表创建成功')
            return True

        except Error as e:
            print(f'[数据库] 创建数据表失败: {e}')
            return False
        finally:
            cursor.close()
            connection.close()

    def initialize(self):
        """初始化数据库"""
        print(f'[数据库] 开始初始化 MySQL 数据库...')
        print(f'[数据库] 连接信息: {self.user}@{self.host}:{self.port}')

        if self.database_exists():
            print(f'[数据库] 数据库 {self.database} 已存在')
        else:
            print(f'[数据库] 数据库 {self.database} 不存在，正在创建...')
            if not self.create_database():
                return False

        if not self.create_tables():
            return False

        print('[数据库] MySQL 数据库初始化完成')
        return True
