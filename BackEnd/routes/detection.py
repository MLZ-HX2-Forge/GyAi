# -*- coding: utf-8 -*-
"""
检测API路由
提供YOLO模型检测接口
"""

import os
import base64
import json
import sqlite3
import numpy as np
import cv2
import torch
from datetime import datetime
from flask import Blueprint, jsonify, request
from io import BytesIO
from PIL import Image
from ultralytics import YOLO

detection_bp = Blueprint('detection', __name__)

MODELS_CONFIG = {
    'dust': {
        'path': 'models/dust.pt',
        'name': '粉尘检测',
        'warning_threshold': 20,
        'count_label_text': '粉尘数量',
        'warning_text': '严重警告：粉尘过高！'
    },
    'fire': {
        'path': 'models/fire_detection_best.pt',
        'name': '火焰检测',
        'warning_threshold': 1,
        'count_label_text': '火焰检测数',
        'warning_text': '火灾警报！检测到火焰！'
    },
    'vest': {
        'path': 'models/vest.pt',
        'name': '反光衣检测',
        'warning_threshold': 0,
        'count_label_text': '反光衣人数',
        'warning_text': '警告：未检测到反光衣！'
    },
    'facemask': {
        'path': 'models/facemask.pt',
        'name': '口罩检测',
        'warning_threshold': 0,
        'count_label_text': '未戴口罩人数',
        'warning_text': '警告：有人未佩戴口罩！',
        'safe_text': '所有人均佩戴口罩，符合规范！'
    },
    'helmet': {
        'path': 'models/helmet.pt',
        'name': '安全帽检测',
        'warning_threshold': 0,
        'count_label_text': '未戴安全帽人数',
        'warning_text': '警告：有人未佩戴安全帽！',
        'safe_text': '所有人均佩戴安全帽，符合规范！'
    },
    'fall': {
        'path': 'models/fall.pt',
        'name': '摔倒/姿态检测',
        'warning_threshold': 1,
        'count_label_text': '异常姿态人数',
        'warning_text': '警告：检测到人员摔倒/危险姿态！',
        'safe_text': '未检测到异常姿态，安全！'
    }
}

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gyai.db')

def init_detection_db():
    data_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detection_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_key TEXT NOT NULL,
            model_name TEXT NOT NULL,
            detection_count INTEGER DEFAULT 0,
            detections TEXT,
            warning TEXT,
            image_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

init_detection_db()

class ModelManager:
    _instance = None
    _models = {}
    _device = None
    _current_single_model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._device = 0 if torch.cuda.is_available() else "cpu"
            print(f"[检测模块] 使用设备: {cls._device} (CUDA可用: {torch.cuda.is_available()})")
        return cls._instance
    
    def load_model(self, model_key):
        if model_key in self._models and self._models[model_key] is not None:
            return self._models[model_key]
        
        if model_key not in MODELS_CONFIG:
            return None
        
        config = MODELS_CONFIG[model_key]
        model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), config['path'])
        
        if not os.path.exists(model_path):
            print(f"[检测模块] 模型文件不存在: {model_path}")
            return None
        
        try:
            print(f"[检测模块] 加载模型: {config['name']} -> {model_path}")
            self._models[model_key] = YOLO(model_path).to(self._device)
            return self._models[model_key]
        except Exception as e:
            print(f"[检测模块] 加载模型失败: {e}")
            return None
    
    def get_model(self, model_key):
        return self.load_model(model_key)
    
    def release_model(self, model_key):
        if model_key in self._models and self._models[model_key] is not None:
            try:
                del self._models[model_key]
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                print(f"[检测模块] 已释放模型: {model_key}")
                return True
            except Exception as e:
                print(f"[检测模块] 释放模型失败: {e}")
                return False
        return True
    
    def release_all_except(self, model_keys):
        released = []
        for key in list(self._models.keys()):
            if key not in model_keys:
                if self.release_model(key):
                    released.append(key)
        return released
    
    def get_device(self):
        return self._device
    
    def get_available_models(self):
        available = []
        for key, config in MODELS_CONFIG.items():
            model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), config['path'])
            if os.path.exists(model_path):
                available.append({
                    'key': key,
                    'name': config['name'],
                    'path': config['path']
                })
        return available

model_manager = ModelManager()

def decode_image(image_data):
    if isinstance(image_data, str):
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
    else:
        image_bytes = image_data
    
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return image

def encode_image(image):
    _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')

def process_detection_results(results, model_key):
    detections = []
    
    if results and len(results) > 0:
        r = results[0]
        
        if r.boxes is not None and len(r.boxes) > 0:
            boxes = r.boxes
            
            for i in range(len(boxes)):
                box = boxes.xyxy[i].cpu().numpy()
                conf = float(boxes.conf[i].cpu().numpy())
                cls = int(boxes.cls[i].cpu().numpy())
                
                cls_name = r.names.get(cls, str(cls)) if r.names else str(cls)
                
                detections.append({
                    'bbox': [float(box[0]), float(box[1]), float(box[2]), float(box[3])],
                    'confidence': round(conf, 3),
                    'class_id': cls,
                    'class_name': cls_name
                })
    
    return detections

def save_detection_result(model_key, model_name, detections, warning=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO detection_results (model_key, model_name, detection_count, detections, warning)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            model_key,
            model_name,
            len(detections),
            json.dumps(detections, ensure_ascii=False),
            warning
        ))
        
        conn.commit()
        result_id = cursor.lastrowid
        conn.close()
        
        return result_id
    except Exception as e:
        print(f"[检测模块] 保存检测结果失败: {e}")
        return None

@detection_bp.route('/models', methods=['GET'])
def get_models():
    try:
        models = model_manager.get_available_models()
        return jsonify({
            'code': 200,
            'data': models,
            'message': '获取模型列表成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'获取模型列表失败: {str(e)}'
        }), 500

@detection_bp.route('/release-model', methods=['POST'])
def release_model():
    try:
        data = request.get_json()
        model_key = data.get('model')
        
        if model_key:
            success = model_manager.release_model(model_key)
            return jsonify({
                'code': 200 if success else 400,
                'message': '模型已释放' if success else '释放模型失败'
            })
        
        return jsonify({
            'code': 400,
            'message': '请指定要释放的模型'
        }), 400
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'释放模型失败: {str(e)}'
        }), 500

@detection_bp.route('/release-unused', methods=['POST'])
def release_unused():
    try:
        data = request.get_json()
        keep_models = data.get('keep_models', [])
        
        released = model_manager.release_all_except(keep_models)
        
        return jsonify({
            'code': 200,
            'data': {'released': released},
            'message': f'已释放 {len(released)} 个未使用的模型'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'释放模型失败: {str(e)}'
        }), 500

@detection_bp.route('/detect', methods=['POST'])
def detect_single():
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'code': 400,
                'message': '请提供图像数据'
            }), 400
        
        model_key = data.get('model', 'dust')
        conf_thres = data.get('confidence', 0.3)
        return_annotated = data.get('return_annotated', True)
        save_result = data.get('save_result', False)
        
        model = model_manager.get_model(model_key)
        if model is None:
            return jsonify({
                'code': 404,
                'message': f'模型 {model_key} 未找到或加载失败'
            }), 404
        
        image = decode_image(data['image'])
        if image is None:
            return jsonify({
                'code': 400,
                'message': '图像解码失败'
            }), 400
        
        device = model_manager.get_device()
        results = model.predict(image, device=device, conf=conf_thres, verbose=False)
        
        detections = process_detection_results(results, model_key)
        
        config = MODELS_CONFIG.get(model_key, {})
        warning = None
        if detections:
            if model_key in ['facemask', 'helmet', 'fall']:
                warning = config.get('warning_text', '')
            elif model_key == 'vest':
                warning = config.get('warning_text', '') if len(detections) == 0 else None
            else:
                if len(detections) >= config.get('warning_threshold', 0):
                    warning = config.get('warning_text', '')
        
        result_id = None
        if save_result:
            result_id = save_detection_result(
                model_key,
                config.get('name', model_key),
                detections,
                warning
            )
        
        response = {
            'code': 200,
            'data': {
                'model': model_key,
                'model_name': config.get('name', model_key),
                'count': len(detections),
                'detections': detections,
                'warning': warning,
                'result_id': result_id
            },
            'message': '检测完成'
        }
        
        if return_annotated and results and len(results) > 0:
            annotated_frame = results[0].plot()
            response['data']['annotated_image'] = encode_image(annotated_frame)
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[检测模块] 检测错误: {e}")
        return jsonify({
            'code': 500,
            'message': f'检测失败: {str(e)}'
        }), 500

@detection_bp.route('/detect-multi', methods=['POST'])
def detect_multi():
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'code': 400,
                'message': '请提供图像数据'
            }), 400
        
        model_keys = data.get('models', [])
        conf_thres = data.get('confidence', 0.3)
        return_annotated = data.get('return_annotated', True)
        save_result = data.get('save_result', False)
        
        if not model_keys:
            model_keys = list(MODELS_CONFIG.keys())
        
        image = decode_image(data['image'])
        if image is None:
            return jsonify({
                'code': 400,
                'message': '图像解码失败'
            }), 400
        
        device = model_manager.get_device()
        all_detections = {}
        annotated_image = image.copy()
        total_warnings = []
        
        for model_key in model_keys:
            model = model_manager.get_model(model_key)
            if model is None:
                continue
            
            results = model.predict(image, device=device, conf=conf_thres, verbose=False)
            detections = process_detection_results(results, model_key)
            
            config = MODELS_CONFIG.get(model_key, {})
            
            warning = None
            if detections:
                if model_key in ['facemask', 'helmet', 'fall']:
                    warning = config.get('warning_text', '')
                    total_warnings.append({
                        'model': model_key,
                        'model_name': config.get('name', model_key),
                        'warning': warning,
                        'count': len(detections)
                    })
                elif model_key == 'vest':
                    if len(detections) == 0:
                        warning = config.get('warning_text', '')
                        total_warnings.append({
                            'model': model_key,
                            'model_name': config.get('name', model_key),
                            'warning': warning,
                            'count': 0
                        })
                else:
                    if len(detections) >= config.get('warning_threshold', 0):
                        warning = config.get('warning_text', '')
                        total_warnings.append({
                            'model': model_key,
                            'model_name': config.get('name', model_key),
                            'warning': warning,
                            'count': len(detections)
                        })
            
            all_detections[model_key] = {
                'model_name': config.get('name', model_key),
                'count': len(detections),
                'detections': detections,
                'warning': warning
            }
            
            if save_result:
                save_detection_result(model_key, config.get('name', model_key), detections, warning)
            
            if results and len(results) > 0 and return_annotated:
                annotated_frame = results[0].plot()
                if model_key == model_keys[0]:
                    annotated_image = annotated_frame.copy()
        
        response = {
            'code': 200,
            'data': {
                'results': all_detections,
                'warnings': total_warnings,
                'total_warnings': len(total_warnings)
            },
            'message': '多模型检测完成'
        }
        
        if return_annotated:
            response['data']['annotated_image'] = encode_image(annotated_image)
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[检测模块] 多模型检测错误: {e}")
        return jsonify({
            'code': 500,
            'message': f'多模型检测失败: {str(e)}'
        }), 500

@detection_bp.route('/results', methods=['GET'])
def get_results():
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
        model_key = request.args.get('model')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        offset = (page - 1) * page_size
        
        if model_key:
            cursor.execute('''
                SELECT id, model_key, model_name, detection_count, detections, warning, created_at
                FROM detection_results
                WHERE model_key = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (model_key, page_size, offset))
            
            cursor.execute('''
                SELECT COUNT(*) FROM detection_results WHERE model_key = ?
            ''', (model_key,))
        else:
            cursor.execute('''
                SELECT id, model_key, model_name, detection_count, detections, warning, created_at
                FROM detection_results
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (page_size, offset))
            
            cursor.execute('SELECT COUNT(*) FROM detection_results')
        
        total = cursor.fetchone()[0]
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                'id': row[0],
                'model_key': row[1],
                'model_name': row[2],
                'detection_count': row[3],
                'detections': json.loads(row[4]) if row[4] else [],
                'warning': row[5],
                'created_at': row[6]
            })
        
        return jsonify({
            'code': 200,
            'data': {
                'results': results,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size
            },
            'message': '获取检测结果成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'获取检测结果失败: {str(e)}'
        }), 500

@detection_bp.route('/results/<int:result_id>', methods=['DELETE'])
def delete_result(result_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM detection_results WHERE id = ?', (result_id,))
        conn.commit()
        
        deleted = cursor.rowcount > 0
        conn.close()
        
        if deleted:
            return jsonify({
                'code': 200,
                'message': '删除成功'
            })
        else:
            return jsonify({
                'code': 404,
                'message': '记录不存在'
            }), 404
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'删除失败: {str(e)}'
        }), 500

@detection_bp.route('/results/clear', methods=['POST'])
def clear_results():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM detection_results')
        conn.commit()
        
        deleted_count = cursor.rowcount
        conn.close()
        
        return jsonify({
            'code': 200,
            'message': f'已清除 {deleted_count} 条记录'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'清除失败: {str(e)}'
        }), 500

@detection_bp.route('/config', methods=['GET'])
def get_config():
    try:
        return jsonify({
            'code': 200,
            'data': MODELS_CONFIG,
            'message': '获取配置成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'message': f'获取配置失败: {str(e)}'
        }), 500
