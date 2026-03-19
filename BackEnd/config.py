# -*- coding: utf-8 -*-
"""
配置管理模块
管理API密钥、模型配置和系统设置
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'gyai-industrial-ai-secret-key-2024'
    
    DEEPSEEK_CONFIG = {
        'api_key': os.environ.get('DEEPSEEK_API_KEY') or '80342011-a203-43aa-8521-3e923b4d6c11',
        'api_url': os.environ.get('DEEPSEEK_API_URL') or 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        'model': os.environ.get('DEEPSEEK_MODEL') or 'deepseek-v3-1-terminus'
    }
    
    KIMI_CONFIG = {
        'api_key': os.environ.get('KIMI_API_KEY') or 'f6728ca1-1b5c-4675-a7c3-233d4a6286aa',
        'api_url': os.environ.get('KIMI_API_URL') or 'https://ark.cn-beijing.volces.com/api/v3',
        'model': os.environ.get('KIMI_MODEL') or 'kimi-k2-250905'
    }
    
    DOUBAO_VISION_CONFIG = {
        'api_key': os.environ.get('DOUBAO_VISION_API_KEY') or '705fd98b-4f56-4fd1-9507-19d6f6c5823a',
        'api_url': os.environ.get('DOUBAO_VISION_API_URL') or 'https://ark.cn-beijing.volces.com/api/v3',
        'model': os.environ.get('DOUBAO_VISION_MODEL') or 'doubao-seed-1-6-vision-250815'
    }
    
    DOUBAO_IMAGE_GEN_CONFIG = {
        'api_key': os.environ.get('DOUBAO_IMAGE_GEN_API_KEY') or 'a531810f-4d83-42eb-8dae-bfd70387ca15',
        'api_url': os.environ.get('DOUBAO_IMAGE_GEN_API_URL') or 'https://ark.cn-beijing.volces.com/api/v3',
        'model': os.environ.get('DOUBAO_IMAGE_GEN_MODEL') or 'doubao-seedream-4-0-250828'
    }
    
    DATABASE_CONFIG = {
        'path': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'gyai.db')
    }
    
    SESSION_CONFIG = {
        'cookie_name': 'gyai_session',
        'max_age': 7 * 24 * 60 * 60
    }
    
    DEFAULT_MODEL = 'deepseek'
    MAX_HISTORY_LENGTH = 50
    STREAM_TIMEOUT = 120

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    DEBUG = True
    TESTING = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
