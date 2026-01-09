

# Arduino_JDY-31_communication，后端通过JDY-31蓝牙与arduino进行简单的通信
import serial
import time
import threading
import sys
from datetime import datetime


class BluetoothDisplayClient:
    """
    蓝牙显示客户端 - 用于向Arduino发送数据
    注意：此代码运行在电脑上，通过串口与Arduino通信
    """

    def __init__(self, port='COM3', baudrate=9600):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self.connected = False
        self.receive_thread = None
        self.running = False

    def connect(self):
        """连接到Arduino"""
        try:
            print(f"正在连接到 {self.port} (波特率: {self.baudrate})")
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                bytesize=serial.EIGHTBITS
            )

            # 等待连接稳定
            time.sleep(2)

            # 清空缓冲区
            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()

            self.connected = True
            print("✓ 成功连接到Arduino")
            print("现在可以通过蓝牙发送数据到显示屏")

            return True

        except Exception as e:
            print(f"✗ 连接失败: {e}")
            return False

    def send_message(self, message):
        """发送消息到Arduino（通过蓝牙转发）"""
        if not self.connected or not self.serial:
            print("未连接到Arduino")
            return False

        try:
            # 确保消息以换行符结束
            if not message.endswith('\n'):
                message += '\n'

            self.serial.write(message.encode('utf-8'))
            print(f"发送: {message.strip()}")
            return True

        except Exception as e:
            print(f"发送失败: {e}")
            return False

    def start_receiving(self):
        """启动接收线程（用于调试信息）"""
        self.running = True
        self.receive_thread = threading.Thread(target=self._receive_loop)
        self.receive_thread.daemon = True
        self.receive_thread.start()

    def _receive_loop(self):
        """接收Arduino发送的调试信息"""
        while self.running and self.connected and self.serial:
            try:
                if self.serial.in_waiting > 0:
                    data = self.serial.read(self.serial.in_waiting).decode('utf-8', errors='ignore')
                    if data.strip():
                        sys.stdout.write(data)
                        sys.stdout.flush()
                time.sleep(0.01)
            except:
                break

    def disconnect(self):
        """断开连接"""
        print("正在断开连接...")
        self.running = False

        if self.receive_thread:
            self.receive_thread.join(timeout=1)

        if self.serial and self.connected:
            self.serial.close()
            self.connected = False

        print("已断开连接")


def list_serial_ports():
    """列出可用串口"""
    import sys

    ports = []

    if sys.platform.startswith('win'):
        # Windows系统
        for i in range(1, 21):
            port = f'COM{i}'
            try:
                s = serial.Serial(port)
                s.close()
                ports.append(port)
            except:
                pass
    else:
        # Linux/Mac系统
        import glob
        port_patterns = ['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/tty.usb*']

        for pattern in port_patterns:
            ports.extend(glob.glob(pattern))

    return ports


def interactive_client():
    """交互式客户端模式"""
    print("=" * 60)
    print("蓝牙显示客户端 - 交互模式")
    print("=" * 60)

    # 列出可用串口
    ports = list_serial_ports()

    if not ports:
        print("未找到可用串口！")
        print("请检查：")
        print("1. Arduino是否连接到电脑")
        print("2. 是否正确安装了驱动程序")
        return

    print("检测到的串口：")
    for i, port in enumerate(ports, 1):
        print(f"  {i}. {port}")

    # 选择串口
    while True:
        try:
            choice = input(f"\n选择串口号 (1-{len(ports)}) 或直接输入端口: ").strip()

            if choice.isdigit():
                index = int(choice) - 1
                if 0 <= index < len(ports):
                    port = ports[index]
                    break
            elif choice:
                port = choice
                break
        except:
            pass
        print("无效选择，请重试")

    # 创建客户端
    client = BluetoothDisplayClient(port=port)

    if client.connect():
        print("\n" + "=" * 60)
        print("连接成功！")
        print("=" * 60)

        # 启动接收线程
        client.start_receiving()

        # 显示命令帮助
        print("\n可用命令：")
        print("  help     - 显示帮助")
        print("  test     - 发送测试消息")
        print("  clear    - 发送清屏命令")
        print("  time     - 发送当前时间")
        print("  quit     - 退出程序")
        print("  其他文字 - 发送到显示屏")
        print("=" * 60)

        # 主循环
        try:
            while True:
                command = input("\n输入命令或消息: ").strip()

                if not command:
                    continue

                if command.lower() == 'quit' or command.lower() == 'exit':
                    print("退出程序")
                    break

                elif command.lower() == 'help':
                    print("\n命令说明：")
                    print("  help        - 显示此帮助")
                    print("  test        - 发送一组测试消息")
                    print("  clear       - 清空显示屏")
                    print("  time        - 显示当前时间")
                    print("  status      - 发送状态查询")
                    print("  quit/exit   - 退出程序")
                    print("  任意文本    - 发送到显示屏显示")

                elif command.lower() == 'test':
                    # 发送测试消息
                    test_messages = [
                        "蓝牙连接测试",
                        "Hello World!",
                        "Arduino蓝牙显示",
                        "TFT屏幕测试",
                        "JDY-31蓝牙模块",
                        "数据传输正常"
                    ]

                    print("发送测试消息...")
                    for msg in test_messages:
                        client.send_message(msg)
                        time.sleep(1)

                elif command.lower() == 'clear':
                    # 发送清屏命令（特殊字符）
                    client.send_message("!CLEAR")
                    print("已发送清屏命令")

                elif command.lower() == 'time':
                    # 发送当前时间
                    current_time = datetime.now().strftime("%H:%M:%S")
                    client.send_message(f"当前时间: {current_time}")

                elif command.lower() == 'status':
                    # 发送状态查询
                    client.send_message("状态查询")
                    client.send_message("设备运行中")

                else:
                    # 发送普通消息
                    client.send_message(command)

        except KeyboardInterrupt:
            print("\n程序被中断")

        finally:
            client.disconnect()

    else:
        print("连接失败，程序退出")


def send_file_to_display(filename, port='COM3'):
    """发送文件内容到显示屏"""
    try:
        client = BluetoothDisplayClient(port=port)

        if client.connect():
            print(f"正在发送文件: {filename}")

            with open(filename, 'r', encoding='utf-8') as file:
                lines = file.readlines()
                total_lines = len(lines)

                for i, line in enumerate(lines, 1):
                    line = line.strip()
                    if line:  # 跳过空行
                        client.send_message(line)
                        print(f"进度: {i}/{total_lines}")
                        time.sleep(0.5)  # 防止发送过快

            client.disconnect()
            print("文件发送完成")
        else:
            print("连接失败")

    except Exception as e:
        print(f"发送文件失败: {e}")






if __name__ == "__main__":

    print("蓝牙显示系统 - 客户端程序")
    print("模式选择：")
    print("1. 交互式模式")
    print("2. 发送测试数据")
    print("3. 从文件发送数据")

    choice = input("请选择模式 (1/2/3): ").strip()

    if choice == "2":
        # 自动测试模式
        client = BluetoothDisplayClient('COM3')
        if client.connect():
            # 发送测试数据
            messages = [
                "系统启动",
                "蓝牙连接正常",
                "显示测试1",
                "显示测试2",
                "显示测试3",
                "测试完成"
            ]

            for msg in messages:
                client.send_message(msg)
                time.sleep(1)

            client.disconnect()

    elif choice == "3":
        # 从文件发送数据
        filename = input("请输入文件名: ").strip()
        port = input("请输入串口号 (默认COM3): ").strip() or 'COM3'
        send_file_to_display(filename, port)

    else:
        # 默认交互式模式
        interactive_client()






