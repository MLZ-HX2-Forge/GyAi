# -*- coding: utf-8 -*-
"""
对话路由
处理AI对话相关请求
"""

import json
from flask import Blueprint, request, Response, stream_with_context, g
from services import llm_service, knowledge_base, conversation_service
from utils.helpers import ResponseBuilder, require_auth, guest_allowed

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

@chat_bp.route('/stream', methods=['POST'])
@require_auth
@guest_allowed
def chat_stream():
    """流式对话"""
    try:
        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        message = data.get('message', '').strip()
        if not message:
            return ResponseBuilder.error(400, '消息不能为空')

        model = data.get('model', 'deepseek')
        history = data.get('history', [])
        images = data.get('images', [])
        conversation_id = data.get('conversation_id')
        use_knowledge = data.get('use_knowledge', True)

        system_prompt = None
        if use_knowledge:
            system_prompt = knowledge_base.get_system_prompt(message)

        if not system_prompt:
            system_prompt = '''你是一位专业的工业AI助手，专注于为工业领域提供专业、准确的技术支持。
你的职责包括：
1. 解答工业生产过程中的技术问题
2. 提供设备维护和故障诊断建议
3. 协助优化生产工艺流程
4. 提供安全生产指导
请用专业、准确、实用的语言回答问题。'''

        if conversation_id:
            saved_history = conversation_service.get_history_for_llm(conversation_id)
            if saved_history:
                history = saved_history

        def generate():
            full_content = ''
            try:
                for chunk in llm_service.chat_stream(
                    message=message,
                    model=model,
                    history=history,
                    system_prompt=system_prompt,
                    images=images
                ):
                    yield chunk

                    if chunk.startswith('data: ') and not chunk.startswith('data: [DONE]'):
                        try:
                            data = json.loads(chunk[6:].strip())
                            if 'content' in data:
                                full_content += data['content']
                        except:
                            pass

                if conversation_id and full_content:
                    conversation_service.add_message(conversation_id, 'user', message, images if images else None)
                    conversation_service.add_message(conversation_id, 'assistant', full_content)

            except GeneratorExit:
                pass
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
                'Content-Encoding': 'none',
                'Transfer-Encoding': 'chunked',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        )

    except Exception as e:
        return ResponseBuilder.error(500, f'服务器错误: {str(e)}')

@chat_bp.route('/sync', methods=['POST'])
@require_auth
@guest_allowed
def chat_sync():
    """同步对话"""
    try:
        data = request.get_json()
        if not data:
            return ResponseBuilder.error(400, '请求数据无效')

        message = data.get('message', '').strip()
        if not message:
            return ResponseBuilder.error(400, '消息不能为空')

        model = data.get('model', 'deepseek')
        history = data.get('history', [])
        images = data.get('images', [])
        use_knowledge = data.get('use_knowledge', True)

        system_prompt = None
        if use_knowledge:
            system_prompt = knowledge_base.get_system_prompt(message)

        result = llm_service.chat_sync(
            message=message,
            model=model,
            history=history,
            system_prompt=system_prompt,
            images=images
        )

        if 'error' in result:
            return ResponseBuilder.error(500, result['error'])

        return ResponseBuilder.success(result)

    except Exception as e:
        return ResponseBuilder.error(500, f'服务器错误: {str(e)}')

@chat_bp.route('/models', methods=['GET'])
def get_models():
    """获取可用模型列表"""
    models = [
        {
            'id': 'deepseek',
            'name': 'DeepSeek V3.1',
            'description': '深度求索大模型，擅长逻辑推理和代码生成',
            'type': 'text',
            'default': True
        },
        {
            'id': 'kimi',
            'name': 'Kimi K2',
            'description': '月之暗面大模型，擅长长文本理解和分析',
            'type': 'text',
            'default': False
        },
        {
            'id': 'doubao_vision',
            'name': '豆包视觉',
            'description': '字节跳动视觉模型，支持图片理解和分析',
            'type': 'vision',
            'default': False
        }
    ]
    return ResponseBuilder.success(models)

@chat_bp.route('/knowledge/categories', methods=['GET'])
def get_knowledge_categories():
    """获取知识库分类"""
    categories = knowledge_base.get_categories()
    return ResponseBuilder.success(categories)
