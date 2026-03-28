# -*- coding: utf-8 -*-
"""
GyAI 工业智能助手 - Flask应用入口
"""

import os
import sys
import warnings
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from config import config

warnings.filterwarnings('ignore', category=DeprecationWarning)
os.environ['FLASK_ENV'] = 'development'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def init_database_on_startup():
    """在应用启动时初始化数据库"""
    try:
        from config import Config
        db_type = getattr(Config, 'DATABASE_TYPE', 'sqlite')

        if db_type == 'mysql':
            print('[数据库] 检测到MySQL配置，开始初始化数据库...')
            try:
                import pymysql
                from scripts.database_init import DatabaseInitializer
                initializer = DatabaseInitializer()
                if initializer.initialize():
                    print('[数据库] MySQL数据库初始化成功!')
                else:
                    print('[数据库] MySQL数据库初始化失败，请检查配置')
            except ImportError:
                print('[数据库] pymysql未安装，请运行: pip install pymysql')
                print('[数据库] 将使用SQLite作为后备数据库')
        else:
            print('[数据库] 使用SQLite数据库')
            migrate_pinned_field()
    except Exception as e:
        print(f'[数据库] 数据库初始化异常: {e}')


def migrate_pinned_field():
    """迁移 pinned 字段"""
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'gyai.db')
        if not os.path.exists(db_path):
            return
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'pinned' not in columns:
            cursor.execute('ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0')
            conn.commit()
            print('[数据库] 迁移 pinned 字段成功')
        
        conn.close()
    except Exception as e:
        print(f'[数据库] pinned 字段迁移失败: {e}')


def create_app(config_name='default'):
    """创建Flask应用"""
    frontend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'FrontEnd')
    
    app = Flask(
        __name__,
        static_folder=frontend_path,
        static_url_path='',
        template_folder=os.path.join(frontend_path, 'html')
    )

    app.config.from_object(config[config_name])

    CORS(app,
         origins=['*'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization'],
         supports_credentials=True)

    from routes import chat_bp, auth_bp, conversation_bp, detection_bp
    app.register_blueprint(chat_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(conversation_bp)
    app.register_blueprint(detection_bp, url_prefix='/api/detection')

    @app.route('/')
    def index():
        return app.send_static_file('html/index.html')

    @app.route('/chat')
    def chat_page():
        return app.send_static_file('html/chat.html')

    @app.route('/monitor')
    def monitor_page():
        return app.send_static_file('html/monitor.html')

    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'GyAI Industrial Assistant',
            'version': '1.0.0'
        })

    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({'code': 404, 'message': '接口不存在'}), 404
        try:
            return app.send_static_file('html/index.html'), 404
        except:
            return jsonify({'code': 404, 'message': '页面不存在'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500

    return app

app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    from config import Config
    db_type = getattr(Config, 'DATABASE_TYPE', 'sqlite')

    if db_type == 'mysql':
        init_database_on_startup()

    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    cli = sys.modules.get('flask.cli')
    if cli:
        cli.show_server_banner = lambda *args: None

    print('=' * 60)
    print('GyAI 工业智能助手')
    print('=' * 60)
    print(f'数据库类型: {db_type.upper()}')
    print(f'服务地址: http://127.0.0.1:5000')
    print(f'主页面: http://127.0.0.1:5000/')
    print(f'对话页面: http://127.0.0.1:5000/chat')
    print(f'监控页面: http://127.0.0.1:5000/monitor')
    print('=' * 60)

    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        threaded=True,
        use_reloader=False
    )
