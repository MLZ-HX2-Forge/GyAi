

import serial
import serial.tools.list_ports
import time
import threading


class BluetoothConnectionTester:
    def __init__(self):
        self.serial_port = None
        self.connected = False

    def list_all_ports(self):
        """列出所有串口并显示详细信息"""
        print("=== 所有可用串口 ===")
        ports = serial.tools.list_ports.comports()

        if not ports:
            print("没有找到任何串口设备")
            return

        for idx, port in enumerate(ports, 1):
            print(f"{idx}. {port.device}")
            print(f"   名称: {port.name}")
            print(f"   描述: {port.description}")
            print(f"   硬件ID: {port.hwid}")
            print("-" * 40)

        return ports

    def test_port(self, port_name):
        """测试指定串口"""
        print(f"\n=== 测试串口: {port_name} ===")

        try:
            # 尝试不同的波特率
            baudrates = [9600, 115200, 57600, 38400, 19200]

            for baudrate in baudrates:
                print(f"尝试波特率 {baudrate}...")

                try:
                    ser = serial.Serial(
                        port=port_name,
                        baudrate=baudrate,
                        timeout=1,
                        write_timeout=1
                    )

                    # 清理缓冲区
                    ser.reset_input_buffer()
                    ser.reset_output_buffer()

                    # 发送测试命令
                    test_commands = [
                        b"AT\r\n",
                        b"AT\r",
                        b"AT\n",
                        b"TEST\r\n",
                        b"CONNECT\r\n"
                    ]

                    for cmd in test_commands:
                        print(f"发送: {cmd}")
                        ser.write(cmd)
                        time.sleep(0.5)

                        # 读取响应
                        if ser.in_waiting:
                            response = ser.read(ser.in_waiting)
                            print(f"收到响应: {response}")
                            if response:
                                print(f"成功使用波特率 {baudrate}")
                                ser.close()
                                return baudrate

                    ser.close()

                except Exception as e:
                    print(f"波特率 {baudrate} 失败: {str(e)}")

        except Exception as e:
            print(f"测试失败: {str(e)}")

        return None

    def connect_to_bluetooth(self, port_name, baudrate=9600):
        """连接到蓝牙设备"""
        print(f"\n=== 尝试连接蓝牙 ===")

        try:
            self.serial_port = serial.Serial(
                port=port_name,
                baudrate=baudrate,
                timeout=2,
                write_timeout=2
            )

            # 清理缓冲区
            time.sleep(2)  # 等待蓝牙模块启动
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()

            # 发送连接命令
            for i in range(3):  # 重试3次
                print(f"发送CONNECT命令 (尝试 {i + 1}/3)")
                self.serial_port.write(b"CONNECT\n")

                # 等待响应
                time.sleep(1)

                if self.serial_port.in_waiting:
                    response = self.serial_port.readline().decode().strip()
                    print(f"收到响应: {response}")

                    if "ACK" in response or "OK" in response:
                        print("连接成功!")
                        self.connected = True
                        return True

                time.sleep(0.5)

            print("连接失败：未收到有效响应")
            self.serial_port.close()
            self.serial_port = None

        except Exception as e:
            print(f"连接异常: {str(e)}")
            self.serial_port = None

        return False

    def manual_test(self):
        """手动测试模式"""
        print("=== 手动测试模式 ===")

        # 列出所有端口
        ports = self.list_all_ports()

        if not ports:
            print("没有找到串口设备，请检查蓝牙模块是否已插入")
            return

        # 选择端口
        print("\n选择要测试的端口:")
        for i, port in enumerate(ports, 1):
            print(f"{i}. {port.device} - {port.description}")

        try:
            choice = int(input("输入序号: "))
            selected_port = ports[choice - 1].device

            # 测试端口
            baudrate = self.test_port(selected_port)

            if baudrate:
                # 尝试连接
                if self.connect_to_bluetooth(selected_port, baudrate):
                    print("开始数据通信测试...")
                    self.communication_test()
            else:
                print("无法确定正确的波特率")

        except Exception as e:
            print(f"操作失败: {str(e)}")

    def communication_test(self):
        """通信测试"""
        if not self.serial_port or not self.connected:
            print("未连接，无法测试")
            return

        print("\n=== 通信测试 ===")
        print("输入 'exit' 退出测试")
        print("输入 'send <消息>' 发送消息")
        print("输入 'status' 查看状态")

        try:
            while True:
                command = input("\n输入命令: ").strip()

                if command.lower() == 'exit':
                    break
                elif command.lower() == 'status':
                    print(f"连接状态: {'已连接' if self.connected else '未连接'}")
                    print(f"端口: {self.serial_port.port if self.serial_port else '无'}")
                elif command.lower().startswith('send '):
                    message = command[5:] + '\n'
                    self.serial_port.write(message.encode())
                    print(f"已发送: {message.strip()}")

                    # 等待响应
                    time.sleep(0.5)
                    if self.serial_port.in_waiting:
                        response = self.serial_port.read(self.serial_port.in_waiting)
                        print(f"收到: {response.decode().strip()}")
                else:
                    print("未知命令")

        except KeyboardInterrupt:
            print("\n测试中断")
        finally:
            if self.serial_port:
                self.serial_port.close()


def main():
    tester = BluetoothConnectionTester()

    print("蓝牙连接问题诊断工具")
    print("=" * 50)

    while True:
        print("\n选择操作:")
        print("1. 列出所有串口")
        print("2. 手动测试")
        print("3. 退出")

        choice = input("请输入选项 (1-3): ").strip()

        if choice == '1':
            tester.list_all_ports()
        elif choice == '2':
            tester.manual_test()
        elif choice == '3':
            break
        else:
            print("无效选项")


if __name__ == "__main__":
    main()