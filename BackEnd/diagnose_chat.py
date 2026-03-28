# -*- coding: utf-8 -*-
"""
聊天功能诊断脚本
检查前后端通信是否正常
"""

import requests
import json
import sys

def test_backend_health():
    """测试后端健康状态"""
    print("=" * 60)
    print("1. 测试后端健康状态")
    print("=" * 60)
    try:
        response = requests.get("http://127.0.0.1:5000/api/health", timeout=5)
        print(f"✅ 后端服务正常: {response.status_code}")
        print(f"   响应: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ 后端服务异常: {e}")
        return False

def test_guest_login():
    """测试游客登录"""
    print("\n" + "=" * 60)
    print("2. 测试游客登录")
    print("=" * 60)
    try:
        response = requests.post("http://127.0.0.1:5000/api/auth/guest", timeout=5)
        data = response.json()
        if data.get('code') == 200:
            print(f"✅ 游客登录成功")
            print(f"   Token: {data['data']['token'][:20]}...")
            return data['data']['token']
        else:
            print(f"❌ 游客登录失败: {data}")
            return None
    except Exception as e:
        print(f"❌ 游客登录异常: {e}")
        return None

def test_chat_stream(token):
    """测试聊天流式API"""
    print("\n" + "=" * 60)
    print("3. 测试聊天流式API")
    print("=" * 60)
    
    if not token:
        print("❌ 没有有效的Token，跳过测试")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'message': '你好',
        'model': 'deepseek',
        'history': [],
        'images': []
    }
    
    try:
        response = requests.post(
            "http://127.0.0.1:5000/api/chat/stream",
            headers=headers,
            json=payload,
            stream=True,
            timeout=30
        )
        
        print(f"✅ 请求成功: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        
        print("\n   接收到的内容:")
        print("   " + "-" * 50)
        
        content_received = False
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]
                    if data != '[DONE]':
                        try:
                            json_data = json.loads(data)
                            if 'content' in json_data:
                                print(f"   {json_data['content']}", end='', flush=True)
                                content_received = True
                            elif 'error' in json_data:
                                print(f"\n   ❌ 错误: {json_data['error']}")
                                return False
                        except json.JSONDecodeError:
                            pass
        
        print("\n   " + "-" * 50)
        
        if content_received:
            print("✅ 成功接收到聊天内容")
            return True
        else:
            print("❌ 未接收到聊天内容")
            return False
            
    except Exception as e:
        print(f"❌ 聊天API异常: {e}")
        return False

def test_frontend_files():
    """测试前端文件是否存在"""
    print("\n" + "=" * 60)
    print("4. 测试前端文件")
    print("=" * 60)
    
    import os
    
    frontend_files = [
        'FrontEnd/html/chat.html',
        'FrontEnd/js/components/chat.js',
        'FrontEnd/js/components/auth.js',
        'FrontEnd/js/services/apiService.js',
        'FrontEnd/css/components/ai-chat.css'
    ]
    
    all_exist = True
    for file_path in frontend_files:
        full_path = os.path.join(os.path.dirname(__file__), file_path)
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            print(f"✅ {file_path} ({size} bytes)")
        else:
            print(f"❌ {file_path} 不存在")
            all_exist = False
    
    return all_exist

def main():
    print("\n🔍 GyAI 聊天功能诊断工具")
    print("=" * 60)
    
    # 测试后端健康
    if not test_backend_health():
        print("\n❌ 后端服务未启动，请先启动后端服务")
        sys.exit(1)
    
    # 测试游客登录
    token = test_guest_login()
    
    # 测试聊天API
    chat_ok = test_chat_stream(token)
    
    # 测试前端文件
    frontend_ok = test_frontend_files()
    
    # 总结
    print("\n" + "=" * 60)
    print("📊 诊断结果总结")
    print("=" * 60)
    
    if chat_ok and frontend_ok:
        print("✅ 聊天功能正常！")
        print("\n💡 请在浏览器中访问: http://127.0.0.1:5000/chat")
        print("   如果浏览器中仍然无法聊天，请检查:")
        print("   1. 浏览器控制台是否有JavaScript错误")
        print("   2. 网络请求是否被阻止（CORS问题）")
        print("   3. 清除浏览器缓存后重试")
    else:
        print("❌ 聊天功能存在问题，请查看上面的详细信息")

if __name__ == '__main__':
    main()
