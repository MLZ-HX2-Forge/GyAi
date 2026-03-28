# -*- coding: utf-8 -*-
"""
用户认证路由
处理用户注册、登录、登出等请求
"""

from flask import Blueprint, request, jsonify, g
from services import auth_service
from utils.helpers import ResponseBuilder, require_auth

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()
        email = (data.get('email') or '').strip() or None
        nickname = (data.get('nickname') or '').strip() or None

        if not username:
            return ResponseBuilder.error(400, '用户名不能为空')
        if not password:
            return ResponseBuilder.error(400, '密码不能为空')

        result = auth_service.register(username, password, email, nickname)

        if result['success']:
            return ResponseBuilder.success(result.get('user'), result['message'])
        else:
            return ResponseBuilder.error(400, result['message'])

    except Exception as e:
        return ResponseBuilder.error(500, f'注册失败: {str(e)}')

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()

        if not username:
            return ResponseBuilder.error(400, '用户名不能为空')
        if not password:
            return ResponseBuilder.error(400, '密码不能为空')

        result = auth_service.login(username, password)

        if result['success']:
            response = jsonify({
                'code': 200,
                'message': result['message'],
                'data': {
                    'token': result['token'],
                    'user': result['user']
                }
            })
            response.set_cookie(
                'gyai_session',
                result['token'],
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite='Lax'
            )
            return response
        else:
            return ResponseBuilder.error(401, result['message'])

    except Exception as e:
        return ResponseBuilder.error(500, f'登录失败: {str(e)}')

@auth_bp.route('/guest', methods=['POST'])
def create_guest():
    """创建游客账户"""
    try:
        result = auth_service.create_guest()

        if result['success']:
            response = jsonify({
                'code': 200,
                'message': '游客模式已启用',
                'data': {
                    'token': result['token'],
                    'user': result['user']
                }
            })
            response.set_cookie(
                'gyai_session',
                result['token'],
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite='Lax'
            )
            return response
        else:
            return ResponseBuilder.error(500, result['message'])

    except Exception as e:
        return ResponseBuilder.error(500, f'创建游客失败: {str(e)}')

@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """用户登出"""
    try:
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            token = token[7:]
        else:
            token = request.cookies.get('gyai_session')

        if token:
            auth_service.logout(token)

        response = ResponseBuilder.success(message='登出成功')
        response.delete_cookie('gyai_session')
        return response

    except Exception as e:
        return ResponseBuilder.error(500, f'登出失败: {str(e)}')

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """获取当前用户信息"""
    try:
        if hasattr(g, 'current_user') and g.current_user:
            return ResponseBuilder.success(g.current_user)
        elif hasattr(g, 'is_guest') and g.is_guest:
            return ResponseBuilder.success({'is_guest': True, 'nickname': '游客用户'})
        else:
            return ResponseBuilder.error(401, '未登录')

    except Exception as e:
        return ResponseBuilder.error(500, f'获取用户信息失败: {str(e)}')

@auth_bp.route('/me', methods=['PUT'])
@require_auth
def update_current_user():
    """更新当前用户信息"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return ResponseBuilder.error(401, '未登录')

        if g.current_user.get('is_guest'):
            return ResponseBuilder.error(403, '游客用户无法修改信息')

        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        result = auth_service.update_user(
            g.current_user['id'],
            nickname=data.get('nickname'),
            avatar=data.get('avatar'),
            settings=data.get('settings')
        )

        if result['success']:
            return ResponseBuilder.success(message=result['message'])
        else:
            return ResponseBuilder.error(400, result['message'])

    except Exception as e:
        return ResponseBuilder.error(500, f'更新失败: {str(e)}')

@auth_bp.route('/check-username', methods=['POST'])
def check_username():
    """检查用户名是否可用"""
    try:
        data = request.get_json()
        username = (data.get('username') or '').strip()

        if not username:
            return ResponseBuilder.error(400, '用户名不能为空')

        from services.auth_service import auth_service
        import sqlite3
        try:
            with auth_service._get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
                if cursor.fetchone():
                    return ResponseBuilder.success({'available': False, 'message': '用户名已被使用'})
                return ResponseBuilder.success({'available': True, 'message': '用户名可用'})
        except:
            return ResponseBuilder.success({'available': True, 'message': '用户名可用'})

    except Exception as e:
        return ResponseBuilder.error(500, f'检查失败: {str(e)}')
