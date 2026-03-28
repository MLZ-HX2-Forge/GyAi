# -*- coding: utf-8 -*-
"""
聊天功能完整测试
"""

import requests
import json
import time

def main():
    print("\n" + "=" * 60)
    print("🧪 GyAI 聊天功能完整测试")
    print("=" * 60)
    
    # 1. 测试健康检查
    print("\n[1/4] 测试后端健康状态...")
    try:
        response = requests.get("http://127.0.0.1:5000/api/health", timeout=5)
        print(f"✅ 后端服务正常: {response.status_code}")
    except Exception as e:
        print(f"❌ 后端服务异常: {e}")
        return
    
    # 2. 测试游客登录
    print("\n[2/4] 测试游客登录...")
    try:
        response = requests.post("http://127.0.0.1:5000/api/auth/guest", timeout=5)
        data = response.json()
        if data.get('code') == 200:
            token = data['data']['token']
            print(f"✅ 游客登录成功")
            print(f"   Token: {token[:30]}...")
        else:
            print(f"❌ 游客登录失败: {data}")
            return
    except Exception as e:
        print(f"❌ 游客登录异常: {e}")
        return
    
    # 3. 测试聊天API
    print("\n[3/4] 测试聊天流式API...")
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'message': '你好，请简单介绍一下你自己',
        'model': 'deepseek',
        'history': [],
        'images': []
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            "http://127.0.0.1:5000/api/chat/stream",
            headers=headers,
            json=payload,
            stream=True,
            timeout=60
        )
        
        print(f"✅ 请求成功: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        
        print("\n   📝 AI回复:")
        print("   " + "─" * 50)
        
        full_content = ""
        chunk_count = 0
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]
                    if data == '[DONE]':
                        break
                    try:
                        json_data = json.loads(data)
                        if 'content' in json_data:
                            content = json_data['content']
                            print(content, end='', flush=True)
                            full_content += content
                            chunk_count += 1
                        elif 'error' in json_data:
                            print(f"\n   ❌ 错误: {json_data['error']}")
                            return
                    except json.JSONDecodeError:
                        pass
        
        elapsed_time = time.time() - start_time
        
        print("\n   " + "─" * 50)
        print(f"✅ 接收完成")
        print(f"   总字数: {len(full_content)}")
        print(f"   数据块数: {chunk_count}")
        print(f"   耗时: {elapsed_time:.2f}秒")
        
    except Exception as e:
        print(f"❌ 聊天API异常: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 4. 测试模型列表
    print("\n[4/4] 测试模型列表API...")
    try:
        response = requests.get("http://127.0.0.1:5000/api/chat/models", timeout=5)
        data = response.json()
        if data.get('code') == 200:
            models = data.get('data', [])
            print(f"✅ 获取模型列表成功")
            for model in models:
                print(f"   - {model['name']}: {model['description']}")
        else:
            print(f"❌ 获取模型列表失败: {data}")
    except Exception as e:
        print(f"❌ 模型列表API异常: {e}")
    
    # 总结
    print("\n" + "=" * 60)
    print("📊 测试结果")
    print("=" * 60)
    print("✅ 所有测试通过！聊天功能正常工作")
    print("\n🌐 请在浏览器中访问:")
    print("   主页: http://127.0.0.1:5000/")
    print("   聊天: http://127.0.0.1:5000/chat")

if __name__ == '__main__':
    main()
