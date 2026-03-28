# -*- coding: utf-8 -*-
"""
对话管理路由
处理对话历史管理
"""

from flask import Blueprint, request, g
from services import conversation_service
from utils.helpers import ResponseBuilder, require_auth

conversation_bp = Blueprint('conversation', __name__, url_prefix='/api/conversations')

@conversation_bp.route('', methods=['GET'])
@require_auth
def get_conversations():
    """获取对话列表"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return ResponseBuilder.error(401, '未登录')

        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 20, type=int)

        conversations = conversation_service.get_conversations(
            g.current_user['id'],
            page=page,
            page_size=page_size
        )

        return ResponseBuilder.success(conversations)

    except Exception as e:
        return ResponseBuilder.error(500, f'获取失败: {str(e)}')

@conversation_bp.route('', methods=['POST'])
@require_auth
def create_conversation():
    """创建新对话"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return ResponseBuilder.error(401, '未登录')

        data = request.get_json() or {}
        title = data.get('title', '新对话')
        model = data.get('model', 'deepseek')

        conv = conversation_service.create_conversation(
            g.current_user['id'],
            title=title,
            model=model
        )

        if 'error' in conv:
            return ResponseBuilder.error(500, conv['error'])

        return ResponseBuilder.success(conv)

    except Exception as e:
        return ResponseBuilder.error(500, f'创建失败: {str(e)}')

@conversation_bp.route('/<conv_id>', methods=['GET'])
@require_auth
def get_conversation(conv_id):
    """获取对话详情"""
    try:
        conv = conversation_service.get_conversation(conv_id)

        if not conv:
            return ResponseBuilder.error(404, '对话不存在')

        messages = conversation_service.get_messages(conv_id)
        conv['messages'] = messages

        return ResponseBuilder.success(conv)

    except Exception as e:
        return ResponseBuilder.error(500, f'获取失败: {str(e)}')

@conversation_bp.route('/<conv_id>', methods=['PUT'])
@require_auth
def update_conversation(conv_id):
    """更新对话"""
    try:
        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        success = conversation_service.update_conversation(
            conv_id,
            title=data.get('title'),
            model=data.get('model')
        )

        if success:
            return ResponseBuilder.success(message='更新成功')
        else:
            return ResponseBuilder.error(400, '更新失败')

    except Exception as e:
        return ResponseBuilder.error(500, f'更新失败: {str(e)}')

@conversation_bp.route('/<conv_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conv_id):
    """删除对话"""
    try:
        success = conversation_service.delete_conversation(conv_id)

        if success:
            return ResponseBuilder.success(message='删除成功')
        else:
            return ResponseBuilder.error(400, '删除失败')

    except Exception as e:
        return ResponseBuilder.error(500, f'删除失败: {str(e)}')

@conversation_bp.route('/<conv_id>/messages', methods=['GET'])
@require_auth
def get_messages(conv_id):
    """获取对话消息"""
    try:
        limit = request.args.get('limit', 100, type=int)
        messages = conversation_service.get_messages(conv_id, limit)

        return ResponseBuilder.success(messages)

    except Exception as e:
        return ResponseBuilder.error(500, f'获取失败: {str(e)}')
