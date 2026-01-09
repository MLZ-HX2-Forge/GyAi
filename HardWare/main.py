import serial
import serial.tools.list_ports
import threading
import time
import json
import os
from datetime import datetime
from queue import Queue
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import matplotlib

matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg


class BluetoothMonitor:
    def __init__(self):
        self.serial_port = None
        self.is_connected = False
        self.data_queue = Queue()
        self.command_queue = Queue()
        self.running = False
        self.config_file = "config.json"
        self.history_file = "history.json"
        self.config = self.load_config()
        self.history = self.load_history()

    def load_config(self):
        """加载配置文件"""
        default_config = {
            "port": "COM10",
            "baudrate": 9600,
            "temp_min": 18.0,
            "temp_max": 30.0,
            "hum_min": 30.0,
            "hum_max": 80.0,
            "auto_connect": False
        }

        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # 更新默认配置
                    for key in default_config:
                        if key in config:
                            default_config[key] = config[key]
            except:
                pass
        return default_config

    def save_config(self):
        """保存配置文件"""
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f, indent=2)

    def load_history(self):
        """加载历史数据"""
        history = []
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    history = json.load(f)
            except:
                pass
        return history

    def save_history(self):
        """保存历史数据"""
        # 只保留最近100条记录
        if len(self.history) > 100:
            self.history = self.history[-100:]

        with open(self.history_file, 'w') as f:
            json.dump(self.history, f, indent=2)

    def get_available_ports(self):
        """获取可用串口列表"""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]

    def connect(self, port=None, baudrate=9600):
        """连接蓝牙设备"""
        if self.is_connected:
            self.disconnect()

        try:
            port = port or self.config['port']
            baudrate = baudrate or self.config['baudrate']

            self.serial_port = serial.Serial(
                port=port,
                baudrate=baudrate,
                timeout=1,  # 缩短超时时间
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                bytesize=serial.EIGHTBITS
            )

            time.sleep(1)  # 缩短等待时间

            # 清空缓冲区
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()

            # 发送连接命令
            self.send_command("CONNECT")
            time.sleep(0.3)

            self.is_connected = True
            self.running = True

            # 启动数据接收线程
            self.receive_thread = threading.Thread(target=self.receive_data, daemon=True)
            self.receive_thread.start()

            # 更新配置
            self.config['port'] = port
            self.config['baudrate'] = baudrate
            self.save_config()

            return True

        except Exception as e:
            print(f"连接失败: {e}")
            return False

    def disconnect(self):
        """断开连接"""
        if self.is_connected:
            try:
                self.send_command("DISCONNECT")
                time.sleep(0.3)
            except:
                pass

            self.running = False
            self.is_connected = False

            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()

    def send_command(self, command):
        """发送命令到Arduino"""
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.write((command + '\n').encode('utf-8'))
                self.serial_port.flush()  # 确保数据立即发送
            except Exception as e:
                print(f"发送命令失败: {e}")

    def receive_data(self):
        """接收数据线程 - 优化版本"""
        buffer = ""
        while self.running and self.is_connected:
            try:
                if self.serial_port and self.serial_port.in_waiting > 0:
                    # 读取所有可用数据
                    raw_data = self.serial_port.read(self.serial_port.in_waiting)
                    buffer += raw_data.decode('utf-8', errors='ignore')

                    # 按行分割处理
                    lines = buffer.split('\n')
                    buffer = lines[-1]  # 保留未完成的行

                    for line in lines[:-1]:  # 处理完整的行
                        line = line.strip()
                        if not line:
                            continue

                        # 解析数据 - 支持两种格式
                        if line.startswith('DATA:'):
                            data_str = line.replace('DATA:', '')
                            parts = data_str.split(',')
                            if len(parts) == 2:
                                self._process_sensor_data(parts[0], parts[1])
                        elif line.startswith('D:'):  # 优化后的格式
                            data_str = line.replace('D:', '')
                            parts = data_str.split(',')
                            if len(parts) == 2:
                                self._process_sensor_data(parts[0], parts[1])
                        elif line.startswith('RESP:'):
                            response = line.replace('RESP:', '')
                            print(f"设备响应: {response}")

            except Exception as e:
                print(f"接收数据错误: {e}")
                break

            time.sleep(0.02)  # 缩短睡眠时间，提高响应速度

    def _process_sensor_data(self, temp_str, hum_str):
        """处理传感器数据"""
        try:
            temperature = float(temp_str)
            humidity = float(hum_str)

            # 创建数据记录
            record = {
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'temperature': temperature,
                'humidity': humidity
            }

            # 添加到历史记录
            self.history.append(record)

            # 放入队列供GUI使用
            self.data_queue.put(record)

            # 定期保存历史数据（每5条保存一次）
            if len(self.history) % 5 == 0:
                self.save_history()

        except ValueError:
            pass

    def get_latest_data(self):
        """获取最新数据"""
        if not self.data_queue.empty():
            return self.data_queue.get()
        return None

    def set_thresholds(self, temp_min, temp_max, hum_min, hum_max):
        """设置阈值"""
        self.config['temp_min'] = temp_min
        self.config['temp_max'] = temp_max
        self.config['hum_min'] = hum_min
        self.config['hum_max'] = hum_max

        # 发送到设备
        command = f"SET_THRESHOLD,{temp_min},{temp_max},{hum_min},{hum_max}"
        self.send_command(command)

        # 保存配置
        self.save_config()

    def request_data(self):
        """请求数据"""
        self.send_command("GET_DATA")

    def get_history(self, limit=50):
        """获取历史数据"""
        return self.history[-limit:] if self.history else []


class EnvironmentalMonitorGUI:
    def __init__(self):
        self.monitor = BluetoothMonitor()
        self.current_data = None

        # 创建主窗口
        self.root = tk.Tk()
        self.root.title("环境监测系统")
        self.root.geometry("900x700")
        self.root.configure(bg='#f0f0f0')

        # 设置样式
        style = ttk.Style()
        style.theme_use('clam')

        # 创建UI
        self.setup_ui()

        # 启动数据更新线程
        self.running = True
        self.update_thread = threading.Thread(target=self.update_data, daemon=True)
        self.update_thread.start()

        # 自动连接（如果配置了）
        if self.monitor.config['auto_connect']:
            self.connect_bluetooth()

    def setup_ui(self):
        """设置用户界面"""
        # 创建主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        # 1. 连接控制区域
        connection_frame = ttk.LabelFrame(main_frame, text="蓝牙连接", padding="10")
        connection_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        # 端口选择
        ttk.Label(connection_frame, text="端口:").grid(row=0, column=0, sticky=tk.W)
        self.port_var = tk.StringVar(value=self.monitor.config['port'])
        self.port_combo = ttk.Combobox(connection_frame, textvariable=self.port_var, width=15)
        self.port_combo.grid(row=0, column=1, padx=(5, 10))

        # 刷新端口按钮
        ttk.Button(connection_frame, text="刷新端口",
                   command=self.refresh_ports).grid(row=0, column=2, padx=5)

        # 连接按钮
        self.connect_btn = ttk.Button(connection_frame, text="连接",
                                      command=self.connect_bluetooth)
        self.connect_btn.grid(row=0, column=3, padx=5)

        # 断开按钮
        self.disconnect_btn = ttk.Button(connection_frame, text="断开",
                                         command=self.disconnect_bluetooth, state='disabled')
        self.disconnect_btn.grid(row=0, column=4, padx=5)

        # 状态显示
        self.status_label = ttk.Label(connection_frame, text="状态: 未连接")
        self.status_label.grid(row=0, column=5, padx=(20, 0))

        # 自动连接复选框
        self.auto_connect_var = tk.BooleanVar(value=self.monitor.config['auto_connect'])
        auto_connect_cb = ttk.Checkbutton(connection_frame, text="自动连接",
                                          variable=self.auto_connect_var)
        auto_connect_cb.grid(row=0, column=6, padx=(20, 0))

        # 2. 数据显示区域
        data_frame = ttk.LabelFrame(main_frame, text="当前数据", padding="10")
        data_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5))

        # 温度显示
        ttk.Label(data_frame, text="温度:", font=('Arial', 12)).grid(row=0, column=0, sticky=tk.W)
        self.temp_label = ttk.Label(data_frame, text="-- °C", font=('Arial', 24, 'bold'))
        self.temp_label.grid(row=1, column=0, pady=(5, 10))

        # 湿度显示
        ttk.Label(data_frame, text="湿度:", font=('Arial', 12)).grid(row=2, column=0, sticky=tk.W)
        self.hum_label = ttk.Label(data_frame, text="-- %", font=('Arial', 24, 'bold'))
        self.hum_label.grid(row=3, column=0, pady=(5, 10))

        # 时间显示
        self.time_label = ttk.Label(data_frame, text="最后更新: --", font=('Arial', 9))
        self.time_label.grid(row=4, column=0, pady=(20, 0))

        # 3. 阈值设置区域
        threshold_frame = ttk.LabelFrame(main_frame, text="阈值设置", padding="10")
        threshold_frame.grid(row=1, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))

        # 温度阈值
        ttk.Label(threshold_frame, text="温度范围 (°C):").grid(row=0, column=0, sticky=tk.W, pady=(0, 5))

        ttk.Label(threshold_frame, text="最小值:").grid(row=1, column=0, sticky=tk.W)
        self.temp_min_var = tk.DoubleVar(value=self.monitor.config['temp_min'])
        ttk.Spinbox(threshold_frame, from_=-10, to=50, increment=0.5,
                    textvariable=self.temp_min_var, width=10).grid(row=1, column=1, padx=(5, 10))

        ttk.Label(threshold_frame, text="最大值:").grid(row=1, column=2, sticky=tk.W)
        self.temp_max_var = tk.DoubleVar(value=self.monitor.config['temp_max'])
        ttk.Spinbox(threshold_frame, from_=-10, to=50, increment=0.5,
                    textvariable=self.temp_max_var, width=10).grid(row=1, column=3, padx=(5, 0))

        # 湿度阈值
        ttk.Label(threshold_frame, text="湿度范围 (%):").grid(row=2, column=0, sticky=tk.W, pady=(10, 5))

        ttk.Label(threshold_frame, text="最小值:").grid(row=3, column=0, sticky=tk.W)
        self.hum_min_var = tk.DoubleVar(value=self.monitor.config['hum_min'])
        ttk.Spinbox(threshold_frame, from_=0, to=100, increment=1,
                    textvariable=self.hum_min_var, width=10).grid(row=3, column=1, padx=(5, 10))

        ttk.Label(threshold_frame, text="最大值:").grid(row=3, column=2, sticky=tk.W)
        self.hum_max_var = tk.DoubleVar(value=self.monitor.config['hum_max'])
        ttk.Spinbox(threshold_frame, from_=0, to=100, increment=1,
                    textvariable=self.hum_max_var, width=10).grid(row=3, column=3, padx=(5, 0))

        # 阈值设置按钮
        ttk.Button(threshold_frame, text="应用阈值",
                   command=self.apply_thresholds).grid(row=4, column=0, columnspan=4, pady=(15, 5))

        # 发送到设备按钮
        ttk.Button(threshold_frame, text="发送到设备",
                   command=self.send_thresholds_to_device).grid(row=5, column=0, columnspan=4)

        # 4. 历史数据区域
        history_frame = ttk.LabelFrame(main_frame, text="历史数据", padding="10")
        history_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(10, 0))

        # 创建文本框显示历史数据
        self.history_text = scrolledtext.ScrolledText(history_frame, height=10, width=80)
        self.history_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # 控制按钮
        button_frame = ttk.Frame(history_frame)
        button_frame.grid(row=1, column=0, sticky=tk.E, pady=(5, 0))

        ttk.Button(button_frame, text="刷新历史",
                   command=self.refresh_history).pack(side=tk.LEFT, padx=5)

        ttk.Button(button_frame, text="清空历史",
                   command=self.clear_history).pack(side=tk.LEFT, padx=5)

        ttk.Button(button_frame, text="导出数据",
                   command=self.export_data).pack(side=tk.LEFT, padx=5)

        # 5. 控制按钮区域
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=3, column=0, columnspan=2, pady=(10, 0))

        ttk.Button(control_frame, text="请求数据",
                   command=self.request_data).pack(side=tk.LEFT, padx=5)

        ttk.Button(control_frame, text="保存配置",
                   command=self.save_config).pack(side=tk.LEFT, padx=5)

        ttk.Button(control_frame, text="退出",
                   command=self.on_closing).pack(side=tk.LEFT, padx=5)

        # 初始刷新端口列表
        self.refresh_ports()

        # 初始刷新历史数据
        self.refresh_history()

    def refresh_ports(self):
        """刷新串口列表"""
        ports = self.monitor.get_available_ports()
        self.port_combo['values'] = ports
        if ports and self.port_var.get() not in ports:
            self.port_var.set(ports[0])

    def connect_bluetooth(self):
        """连接蓝牙"""
        port = self.port_var.get()

        if not port:
            messagebox.showerror("错误", "请选择串口")
            return

        # 更新自动连接配置
        self.monitor.config['auto_connect'] = self.auto_connect_var.get()

        # 连接设备
        if self.monitor.connect(port):
            self.connect_btn.config(state='disabled')
            self.disconnect_btn.config(state='normal')
            self.status_label.config(text="状态: 已连接")
            messagebox.showinfo("成功", f"已连接到 {port}")
        else:
            messagebox.showerror("错误", f"无法连接到 {port}")

    def disconnect_bluetooth(self):
        """断开蓝牙连接"""
        self.monitor.disconnect()
        self.connect_btn.config(state='normal')
        self.disconnect_btn.config(state='disabled')
        self.status_label.config(text="状态: 未连接")

        # 更新数据显示
        self.temp_label.config(text="-- °C")
        self.hum_label.config(text="-- %")
        self.time_label.config(text="最后更新: --")

    def apply_thresholds(self):
        """应用阈值设置"""
        try:
            temp_min = self.temp_min_var.get()
            temp_max = self.temp_max_var.get()
            hum_min = self.hum_min_var.get()
            hum_max = self.hum_max_var.get()

            # 验证阈值
            if temp_min >= temp_max:
                messagebox.showerror("错误", "温度最小值必须小于最大值")
                return

            if hum_min >= hum_max:
                messagebox.showerror("错误", "湿度最小值必须小于最大值")
                return

            # 保存到配置
            self.monitor.set_thresholds(temp_min, temp_max, hum_min, hum_max)
            messagebox.showinfo("成功", "阈值已保存")

        except ValueError:
            messagebox.showerror("错误", "请输入有效的数值")

    def send_thresholds_to_device(self):
        """发送阈值到设备"""
        if not self.monitor.is_connected:
            messagebox.showwarning("警告", "请先连接设备")
            return

        self.apply_thresholds()  # 先应用阈值
        messagebox.showinfo("成功", "阈值已发送到设备")

    def request_data(self):
        """请求数据"""
        if not self.monitor.is_connected:
            messagebox.showwarning("警告", "请先连接设备")
            return

        self.monitor.request_data()

    def refresh_history(self):
        """刷新历史数据显示"""
        history = self.monitor.get_history(20)  # 获取最近20条记录

        self.history_text.delete(1.0, tk.END)

        if not history:
            self.history_text.insert(tk.END, "无历史数据")
            return

        # 添加表头
        header = f"{'时间':<20} {'温度(°C)':<10} {'湿度(%)':<10}\n"
        self.history_text.insert(tk.END, header)
        self.history_text.insert(tk.END, "-" * 40 + "\n")

        # 添加数据行
        for record in reversed(history):  # 最新数据显示在最上面
            line = f"{record['timestamp']:<20} {record['temperature']:<10.1f} {record['humidity']:<10.1f}\n"
            self.history_text.insert(tk.END, line)

    def clear_history(self):
        """清空历史数据"""
        if messagebox.askyesno("确认", "确定要清空所有历史数据吗？"):
            self.monitor.history = []
            self.monitor.save_history()
            self.refresh_history()

    def export_data(self):
        """导出数据到文件"""
        if not self.monitor.history:
            messagebox.showinfo("提示", "没有数据可导出")
            return

        filename = f"environment_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                # 写入表头
                f.write("时间,温度(°C),湿度(%)\n")

                # 写入数据
                for record in self.monitor.history:
                    f.write(f"{record['timestamp']},{record['temperature']:.1f},{record['humidity']:.1f}\n")

            messagebox.showinfo("成功", f"数据已导出到 {filename}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")

    def save_config(self):
        """保存配置"""
        try:
            self.apply_thresholds()  # 保存阈值
            self.monitor.config['auto_connect'] = self.auto_connect_var.get()
            self.monitor.save_config()
            messagebox.showinfo("成功", "配置已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {e}")

    def update_data(self):
        """更新数据线程 - 优化版本"""
        while self.running:
            try:
                # 获取最新数据，批量处理避免UI阻塞
                data_count = 0
                while data_count < 5 and not self.monitor.data_queue.empty():
                    data = self.monitor.get_latest_data()
                    if data:
                        self.current_data = data
                        # 在主线程中更新UI
                        self.root.after(0, self.update_ui, data)
                        data_count += 1
                    else:
                        break

                # 更新端口状态
                if self.monitor.is_connected:
                    self.root.after(0, self.update_status_connected)
                else:
                    self.root.after(0, self.update_status_disconnected)

            except Exception as e:
                print(f"更新数据错误: {e}")

            time.sleep(0.1)  # 缩短更新间隔

    def update_ui(self, data):
        """更新UI显示"""
        # 更新温度湿度显示
        temp = data['temperature']
        hum = data['humidity']

        self.temp_label.config(text=f"{temp:.1f} °C")
        self.hum_label.config(text=f"{hum:.1f} %")

        # 根据阈值改变颜色
        temp_min = self.temp_min_var.get()
        temp_max = self.temp_max_var.get()
        hum_min = self.hum_min_var.get()
        hum_max = self.hum_max_var.get()

        if temp < temp_min or temp > temp_max:
            self.temp_label.config(foreground='red')
        else:
            self.temp_label.config(foreground='black')

        if hum < hum_min or hum > hum_max:
            self.hum_label.config(foreground='red')
        else:
            self.hum_label.config(foreground='black')

        # 更新时间
        self.time_label.config(text=f"最后更新: {data['timestamp']}")

        # 自动刷新历史数据显示
        self.refresh_history()

    def update_status_connected(self):
        """更新连接状态为已连接"""
        if not self.connect_btn.cget('state') == 'disabled':
            self.connect_btn.config(state='disabled')
            self.disconnect_btn.config(state='normal')
            self.status_label.config(text="状态: 已连接")

    def update_status_disconnected(self):
        """更新连接状态为未连接"""
        if not self.connect_btn.cget('state') == 'normal':
            self.connect_btn.config(state='normal')
            self.disconnect_btn.config(state='disabled')
            self.status_label.config(text="状态: 未连接")

            # 清空数据显示
            self.temp_label.config(text="-- °C", foreground='black')
            self.hum_label.config(text="-- %", foreground='black')
            self.time_label.config(text="最后更新: --")

    def on_closing(self):
        """关闭窗口时的处理"""
        self.running = False
        self.monitor.disconnect()
        self.root.destroy()

    def run(self):
        """运行GUI"""
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()


# 配置文件模板
config_template = {
    "port": "COM10",
    "baudrate": 9600,
    "temp_min": 18.0,
    "temp_max": 30.0,
    "hum_min": 30.0,
    "hum_max": 80.0,
    "auto_connect": False
}

# 安装所需库的requirements.txt内容
requirements = """
pyserial>=3.5
matplotlib>=3.5.0
"""

if __name__ == "__main__":
    # 检查是否需要创建配置文件
    if not os.path.exists("config.json"):
        with open("config.json", "w") as f:
            json.dump(config_template, f, indent=2)
        print("已创建默认配置文件 config.json")

    # 运行应用程序
    app = EnvironmentalMonitorGUI()
    app.run()