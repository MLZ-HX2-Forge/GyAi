# -*- coding: utf-8 -*-
"""
LLM服务模块
集成火山引擎API，支持DeepSeek、Kimi、豆包模型
"""

import json
import time
import requests
from typing import Generator, List, Dict, Optional, Any
from config import Config

class LLMService:
    """LLM服务类"""
    
    def __init__(self):
        self.config = Config()
        self.models = {
            'deepseek': self.config.DEEPSEEK_CONFIG,
            'kimi': self.config.KIMI_CONFIG,
            'doubao_vision': self.config.DOUBAO_VISION_CONFIG,
            'doubao_image': self.config.DOUBAO_IMAGE_GEN_CONFIG
        }
        self.default_model = 'deepseek'
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        """构建请求头"""
        return {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def _build_messages(self, 
                        user_message: str, 
                        history: List[Dict] = None,
                        system_prompt: str = None,
                        images: List[str] = None) -> List[Dict]:
        """构建消息列表"""
        messages = []
        
        if system_prompt:
            messages.append({
                'role': 'system',
                'content': system_prompt
            })
        
        if history:
            for msg in history:
                messages.append({
                    'role': msg.get('role', 'user'),
                    'content': msg.get('content', '')
                })
        
        if images:
            content = [{'type': 'text', 'text': user_message}]
            for img_data in images:
                if img_data.startswith('data:'):
                    img_data = img_data.split(',', 1)[1] if ',' in img_data else img_data
                content.append({
                    'type': 'image_url',
                    'image_url': {
                        'url': f'data:image/jpeg;base64,{img_data}'
                    }
                })
            messages.append({'role': 'user', 'content': content})
        else:
            messages.append({'role': 'user', 'content': user_message})
        
        return messages
    
    def _get_model_config(self, model: str, has_images: bool = False) -> Dict:
        """获取模型配置"""
        if has_images and model != 'doubao_vision':
            return self.models['doubao_vision']
        return self.models.get(model, self.models[self.default_model])
    
    def chat_stream(self,
                    message: str,
                    model: str = None,
                    history: List[Dict] = None,
                    system_prompt: str = None,
                    images: List[str] = None,
                    temperature: float = 0.7,
                    max_tokens: int = 4096) -> Generator[str, None, None]:
        """流式对话"""
        model = model or self.default_model
        has_images = bool(images)
        model_config = self._get_model_config(model, has_images)
        
        headers = self._build_headers(model_config['api_key'])
        messages = self._build_messages(message, history, system_prompt, images)
        
        payload = {
            'model': model_config['model'],
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'stream': True
        }
        
        try:
            response = requests.post(
                model_config['api_url'],
                headers=headers,
                json=payload,
                stream=True,
                timeout=Config.STREAM_TIMEOUT
            )
            
            if response.status_code != 200:
                error_msg = f"API请求失败: {response.status_code}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', error_msg)
                except:
                    pass
                yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"
                return
            
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data = line[6:]
                        if data == '[DONE]':
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                content = delta.get('content', '')
                                if content:
                                    yield f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
                        except json.JSONDecodeError:
                            continue
                            
        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': '请求超时，请稍后重试'}, ensure_ascii=False)}\n\n"
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': f'网络错误: {str(e)}'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'服务错误: {str(e)}'}, ensure_ascii=False)}\n\n"
    
    def chat_sync(self,
                  message: str,
                  model: str = None,
                  history: List[Dict] = None,
                  system_prompt: str = None,
                  images: List[str] = None,
                  temperature: float = 0.7,
                  max_tokens: int = 4096) -> Dict[str, Any]:
        """同步对话"""
        model = model or self.default_model
        has_images = bool(images)
        model_config = self._get_model_config(model, has_images)
        
        headers = self._build_headers(model_config['api_key'])
        messages = self._build_messages(message, history, system_prompt, images)
        
        payload = {
            'model': model_config['model'],
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'stream': False
        }
        
        try:
            response = requests.post(
                model_config['api_url'],
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200:
                error_msg = f"API请求失败: {response.status_code}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', error_msg)
                except:
                    pass
                return {'error': error_msg}
            
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                content = result['choices'][0].get('message', {}).get('content', '')
                return {
                    'content': content,
                    'model': model_config['model'],
                    'usage': result.get('usage', {})
                }
            
            return {'error': '响应格式错误'}
            
        except Exception as e:
            return {'error': str(e)}
    
    def generate_image(self, prompt: str, model: str = 'doubao_image') -> Dict[str, Any]:
        """图片生成"""
        model_config = self.models.get(model, self.models['doubao_image'])
        headers = self._build_headers(model_config['api_key'])
        
        payload = {
            'model': model_config['model'],
            'prompt': prompt,
            'n': 1,
            'size': '1024x1024'
        }
        
        try:
            response = requests.post(
                model_config['api_url'],
                headers=headers,
                json=payload,
                timeout=120
            )
            
            if response.status_code != 200:
                return {'error': f'图片生成失败: {response.status_code}'}
            
            result = response.json()
            if 'data' in result and len(result['data']) > 0:
                return {'image_url': result['data'][0].get('url', '')}
            
            return {'error': '图片生成失败'}
            
        except Exception as e:
            return {'error': str(e)}

class IndustrialKnowledgeBase:
    """工业知识库"""
    
    def __init__(self):
        self.knowledge = {
            '设备维护': {
                'description': '工业设备维护保养知识',
                'keywords': ['维护', '保养', '检修', '设备', '故障'],
                'system_prompt': '''你是一位专业的工业设备维护专家。你的职责是:
1. 提供设备维护保养的专业建议
2. 分析设备故障原因并提供解决方案
3. 制定预防性维护计划
4. 解答设备操作相关问题
请用专业、准确的语言回答问题。'''
            },
            '安全生产': {
                'description': '工业安全生产知识',
                'keywords': ['安全', '防护', '危险', '事故', '应急'],
                'system_prompt': '''你是一位工业安全生产专家。你的职责是:
1. 提供安全生产规范和指导
2. 分析潜在安全风险
3. 制定应急预案和安全措施
4. 解答安全生产相关问题
请用严谨、专业的语言回答问题。'''
            },
            '工艺优化': {
                'description': '工业生产工艺优化',
                'keywords': ['工艺', '优化', '效率', '质量', '改进'],
                'system_prompt': '''你是一位工业生产工艺优化专家。你的职责是:
1. 分析生产流程并提出优化建议
2. 提高生产效率和产品质量
3. 降低生产成本和能耗
4. 解答工艺改进相关问题
请用专业、实用的语言回答问题。'''
            },
            '质量管理': {
                'description': '工业质量管理体系',
                'keywords': ['质量', '检测', '标准', '认证', '体系'],
                'system_prompt': '''你是一位工业质量管理专家。你的职责是:
1. 建立和完善质量管理体系
2. 制定质量标准和检测方案
3. 分析质量问题并提出改进措施
4. 解答质量管理相关问题
请用专业、系统的语言回答问题。'''
            }
        }
    
    def get_system_prompt(self, query: str) -> Optional[str]:
        """根据查询获取合适的系统提示"""
        query_lower = query.lower()
        for category, info in self.knowledge.items():
            for keyword in info['keywords']:
                if keyword in query_lower:
                    return info['system_prompt']
        return None
    
    def get_categories(self) -> List[Dict]:
        """获取所有知识分类"""
        return [
            {'name': k, 'description': v['description']}
            for k, v in self.knowledge.items()
        ]

llm_service = LLMService()
knowledge_base = IndustrialKnowledgeBase()
