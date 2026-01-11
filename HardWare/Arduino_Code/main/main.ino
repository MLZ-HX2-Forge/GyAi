#include "DHT22Sensor.h"
#include "TFTDisplay.h"
#include "BluetoothModule.h"

// ==================== 引脚连接定义 ====================
// TFT屏幕引脚连接（1.8寸 ST7735）
#define TFT_CS   A5     // 芯片选择
#define TFT_DC   A3     // 数据/命令选择
#define TFT_RST  A4     // 复位
#define TFT_BL   A0     // 背光控制
#define TFT_SCLK A1     // SPI时钟
#define TFT_MOSI A2     // SPI数据输出

// DHT22传感器引脚连接
#define DHTPIN   4      // 数据引脚

// HC-05蓝牙模块引脚连接
#define BLUETOOTH_RX 2  // 蓝牙模块TX -> Arduino RX
#define BLUETOOTH_TX 3  // 蓝牙模块RX -> Arduino TX

// ==================== 对象创建 ====================
TFTDisplay tftDisplay(TFT_CS, TFT_DC, TFT_RST, TFT_SCLK, TFT_MOSI);
DHT22Sensor dhtSensor(DHTPIN);
BluetoothModule bluetooth(BLUETOOTH_RX, BLUETOOTH_TX);

// ==================== 全局变量 ====================
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
const unsigned long SENSOR_READ_INTERVAL = 2000;  // 2秒读取一次传感器
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000; // 1秒更新一次显示

float currentTemp = 0.0;
float currentHum = 0.0;
String deviceStatus = "INIT";

// ==================== 初始化函数 ====================
void setup() {
  Serial.begin(9600);
  Serial.println("======================================");
  Serial.println("环境监测系统启动中...");
  Serial.println("======================================");
  
  // 初始化背光引脚
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);  // 打开背光
  Serial.println("TFT背光已开启");
  
  // 初始化屏幕
  tftDisplay.begin();
  Serial.println("TFT屏幕初始化完成");
  
  // 显示初始化界面
  tftDisplay.clearScreen();
  tftDisplay.drawHeader();
  tftDisplay.displayMessage("系统启动中...", ST7735_YELLOW);
  tftDisplay.drawFooter("INIT");
  Serial.println("初始化界面显示完成");
  
  // 初始化传感器
  dhtSensor.begin();
  Serial.println("DHT22传感器初始化完成");
  
  // 初始化蓝牙模块
  bluetooth.begin();
  Serial.println("蓝牙模块初始化完成");
  
  // 等待传感器稳定
  delay(2000);
  
  // 显示静态元素
  tftDisplay.displayStaticElements();
  tftDisplay.drawFooter("READY");
  
  deviceStatus = "RUNNING";
  Serial.println("======================================");
  Serial.println("系统准备就绪");
  Serial.println("======================================");
}

// ==================== 主循环 ====================
void loop() {
  unsigned long currentMillis = millis();
  
  // 1. 读取传感器数据
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    if (dhtSensor.readData()) {
      currentTemp = dhtSensor.getTemperature();
      currentHum = dhtSensor.getHumidity();
      
      Serial.print("传感器数据: ");
      Serial.println(dhtSensor.getFormattedData());
      
      // 发送数据到蓝牙
      bluetooth.sendData(currentTemp, currentHum);
    } else {
      Serial.println("错误: 无法读取DHT22传感器数据!");
      tftDisplay.displayMessage("传感器错误!", ST7735_RED);
    }
    lastSensorRead = currentMillis;
  }
  
  // 2. 更新显示（只更新变化的数值）
  if (currentMillis - lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL) {
    tftDisplay.displayData(currentTemp, currentHum);
    tftDisplay.drawFooter(deviceStatus);
    lastDisplayUpdate = currentMillis;
  }
  
  // 3. 检查蓝牙命令
  if (bluetooth.checkCommand()) {
    String command = bluetooth.getCommand();
    Serial.print("蓝牙命令: ");
    Serial.println(command);
    processBluetoothCommand(command);
  }
  
  // 4. 检查串口命令（用于调试）
  if (Serial.available()) {
    String serialCmd = Serial.readStringUntil('\n');
    serialCmd.trim();
    processSerialCommand(serialCmd);
  }
}

// ==================== 蓝牙命令处理 ====================
void processBluetoothCommand(String command) {
  if (command.startsWith("GET_DATA")) {
    bluetooth.sendData(currentTemp, currentHum);
  }
  else if (command.startsWith("SET_THRESHOLD")) {
    // 格式: SET_THRESHOLD,tempMin,tempMax,humMin,humMax
    int firstComma = command.indexOf(',');
    int secondComma = command.indexOf(',', firstComma + 1);
    int thirdComma = command.indexOf(',', secondComma + 1);
    int fourthComma = command.indexOf(',', thirdComma + 1);
    
    if (firstComma > 0 && secondComma > 0 && thirdComma > 0 && fourthComma > 0) {
      float tempMin = command.substring(firstComma + 1, secondComma).toFloat();
      float tempMax = command.substring(secondComma + 1, thirdComma).toFloat();
      float humMin = command.substring(thirdComma + 1, fourthComma).toFloat();
      float humMax = command.substring(fourthComma + 1).toFloat();
      
      tftDisplay.updateThresholds(tempMin, tempMax, humMin, humMax);
      tftDisplay.displayData(currentTemp, currentHum);
      bluetooth.sendResponse("THRESHOLD_SET");
      Serial.println("阈值已更新");
    }
  }
  else if (command.startsWith("TOGGLE_THRESHOLD")) {
    tftDisplay.toggleThresholdDisplay();
    tftDisplay.displayData(currentTemp, currentHum);
    bluetooth.sendResponse("THRESHOLD_TOGGLED");
    Serial.println("阈值显示已切换");
  }
  else if (command.startsWith("STATUS")) {
    bluetooth.sendResponse("STATUS:" + deviceStatus);
  }
  else if (command.startsWith("CONNECT")) {
    bluetooth.updateConnectionStatus(true);
    deviceStatus = "CONNECTED";
    tftDisplay.drawFooter(deviceStatus);
    Serial.println("蓝牙已连接");
  }
  else if (command.startsWith("DISCONNECT")) {
    bluetooth.updateConnectionStatus(false);
    deviceStatus = "RUNNING";
    tftDisplay.drawFooter(deviceStatus);
    Serial.println("蓝牙已断开");
  }
  else {
    bluetooth.sendResponse("UNKNOWN_CMD");
    Serial.println("未知蓝牙命令");
  }
}

// ==================== 串口命令处理 ====================
void processSerialCommand(String command) {
  if (command == "help") {
    Serial.println("可用命令:");
    Serial.println("  status - 获取系统状态");
    Serial.println("  data - 获取当前传感器数据");
    Serial.println("  thresholds - 切换阈值显示");
    Serial.println("  backlight_on - 打开背光");
    Serial.println("  backlight_off - 关闭背光");
    Serial.println("  clear - 清除屏幕");
  }
  else if (command == "status") {
    Serial.print("状态: ");
    Serial.println(deviceStatus);
    Serial.print("温度: ");
    Serial.print(currentTemp);
    Serial.print("°C, 湿度: ");
    Serial.print(currentHum);
    Serial.println("%");
  }
  else if (command == "data") {
    Serial.println(dhtSensor.getFormattedData());
  }
  else if (command == "thresholds") {
    tftDisplay.toggleThresholdDisplay();
    tftDisplay.displayData(currentTemp, currentHum);
    Serial.println("阈值显示已切换");
  }
  else if (command == "backlight_on") {
    digitalWrite(TFT_BL, HIGH);
    Serial.println("背光已打开");
  }
  else if (command == "backlight_off") {
    digitalWrite(TFT_BL, LOW);
    Serial.println("背光已关闭");
  }
  else if (command == "clear") {
    tftDisplay.clearScreen();
    Serial.println("屏幕已清除");
  }
}