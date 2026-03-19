# -*- coding: utf-8 -*-
"""
GyAI 工业智能助手 - Flask应用入口
"""

import os
import sys
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from config import config

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_app(config_name='default'):
    """创建Flask应用"""
    app = Flask(
        __name__,
        static_folder='../FrontEnd',
        static_url_path='',
        template_folder='../FrontEnd/html'
    )
    
    app.config.from_object(config[config_name])
    
    CORS(app, 
         origins=['*'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization'],
         supports_credentials=True)
    
    from routes import chat_bp, auth_bp, conversation_bp
    app.register_blueprint(chat_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(conversation_bp)
    
    @app.route('/')
    def index():
        return send_from_directory('../FrontEnd/html', 'index.html')
    
    @app.route('/chat')
    def chat_page():
        return send_from_directory('../FrontEnd/html', 'chat.html')
    
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
        return send_from_directory('../FrontEnd/html', 'index.html'), 404
    
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500
    
    return app

from flask import request

app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    print('=' * 60)
    print('GyAI 工业智能助手')
    print('=' * 60)
    print(f'服务地址: http://127.0.0.1:5000')
    print(f'主页面: http://127.0.0.1:5000/')
    print(f'对话页面: http://127.0.0.1:5000/chat')
    print('=' * 60)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
