
# 通过Python与蓝牙建立简单连接，进行数据传输
import serial
import time


def simple_bluetooth_connect(port='COM10', baudrate=9600):
    """
    一个极简的蓝牙串口连接测试函数。
    默认连接到 COM10，波特率 9600。
    """
    ser = None
    try:
        print(f"正在尝试连接 {port}，波特率 {baudrate}...")

        # 【关键修复】将 EIGHT_BITS 改为 EIGHTBITS
        ser = serial.Serial(
            port=port,
            baudrate=baudrate,
            timeout=2,  # 设置较长的超时等待初始响应
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS  # 注意：此处已修正为 EIGHTBITS
        )

        # 给串口和蓝牙模块一点稳定时间
        time.sleep(2)

        # 清空可能的旧数据
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        print("✓ 串口连接成功！")
        print(f"   端口: {ser.port}")
        print(f"   波特率: {ser.baudrate}")

        # --- 基础功能测试 ---
        # 1. 发送一条测试消息
        test_message = "Hello from PC!\n"
        ser.write(test_message.encode('utf-8'))
        print(f"✓ 已发送测试消息: '{test_message.strip()}'")
        time.sleep(0.5)  # 等待Arduino响应

        # 2. 尝试读取Arduino可能返回的任何数据（例如回显或确认）
        print("正在等待设备响应（最长等待2秒）...")
        if ser.in_waiting > 0:
            response = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
            if response.strip():
                print(f"✓ 收到设备回复: {response.strip()}")
            else:
                print("   （设备无数据回复，可能是正常现象）")
        else:
            print("   （等待时间内未收到设备数据）")

        # 3. 保持连接，允许手动发送消息
        print("\n--- 进入简易交互模式 ---")
        print("您现在可以输入文字发送给蓝牙设备。")
        print("输入 'quit' 或按 Ctrl+C 退出。")
        print("-" * 30)

        while True:
            user_input = input("输入要发送的消息: ").strip()
            if user_input.lower() == 'quit':
                print("退出交互模式。")
                break
            if user_input:  # 非空输入
                ser.write((user_input + '\n').encode('utf-8'))
                print(f"已发送: '{user_input}'")
                # 可选：等待并读取简短回复
                time.sleep(0.1)
                if ser.in_waiting > 0:
                    reply = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
                    if reply.strip():
                        print(f"设备回复: {reply.strip()}")

    except serial.SerialException as e:
        # 专门捕获串口相关的异常
        print(f"✗ 串口连接失败（SerialException）: {e}")
        print("\n可能的原因：")
        print("  1. 端口号错误（请检查设备管理器中的COM口号）")
        print("  2. 波特率不匹配（请确认与Arduino程序设置一致）")
        print("  3. 端口被其他程序占用（如Arduino IDE串口监视器）")
        print("  4. 蓝牙物理连接未就绪")
    except Exception as e:
        # 捕获其他所有异常
        print(f"✗ 发生未知错误: {e}")
    finally:
        # 确保无论如何都尝试关闭串口
        if ser and ser.is_open:
            ser.close()
            print("串口连接已关闭。")




if __name__ == "__main__":

    # 请根据您的设备管理器显示修改此端口号！
    # 通常配对成功后，选择“蓝牙标准链接串口行（COMXX）”中的第一个，例如COM10。
    your_com_port = 'COM10'  # <<< 请修改为你的实际端口号

    # 调用连接函数
    simple_bluetooth_connect(port=your_com_port)






