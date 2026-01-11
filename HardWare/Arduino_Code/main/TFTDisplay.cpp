#include "TFTDisplay.h"

TFTDisplay::TFTDisplay(uint8_t cs, uint8_t dc, uint8_t rst, uint8_t sclk, uint8_t mosi) {
  // 使用软件SPI：CS, DC, MOSI, SCLK, RST
  tft = new Adafruit_ST7735(cs, dc, mosi, sclk, rst);
}

void TFTDisplay::begin() {
  // 初始化ST7735屏幕
  tft->initR(INITR_BLACKTAB);
  tft->setRotation(3);  // 横向显示
  
  // 清除屏幕，设置为黑色背景
  tft->fillScreen(ST7735_BLACK);
  tft->setTextWrap(false);
  
  // 显示初始化信息
  tft->setCursor(10, 50);
  tft->setTextColor(ST7735_WHITE);
  tft->setTextSize(1);
  tft->println("Initializing...");
}

void TFTDisplay::clearScreen() {
  tft->fillScreen(ST7735_BLACK);
}

void TFTDisplay::displayStaticElements() {
  // 清除数据显示区域
  clearDataArea();
  
  // 设置文本颜色为白色
  tft->setTextColor(ST7735_WHITE);
  tft->setTextSize(1);
  
  // 显示温度标签（静态）
  tft->setCursor(10, 30);
  tft->print("Tem:");
  
  // 显示湿度标签（静态）
  tft->setCursor(10, 80);
  tft->print("Hum:");
  
  // 显示单位（静态）
  tft->setCursor(100, 50);
  tft->setTextSize(2);
  tft->print("C");
  
  tft->setCursor(100, 100);
  tft->setTextSize(2);
  tft->print("%");
}

void TFTDisplay::clearDataArea() {
  // 清除数据显示区域（保留页眉页脚）
  tft->fillRect(0, 20, 160, 120, ST7735_BLACK);
}

void TFTDisplay::displayData(float temperature, float humidity) {
  // 如果是第一次显示，先显示静态元素
  if (lastTemperature < -50.0) {  // 从未显示过
    displayStaticElements();
  }
  
  // 更新温度（如果需要）
  updateTemperature(temperature);
  
  // 更新湿度（如果需要）
  updateHumidity(humidity);
  
  // 保存当前值
  lastTemperature = temperature;
  lastHumidity = humidity;
}

void TFTDisplay::updateTemperature(float temperature) {
  // 如果温度没有变化，则不更新
  if (abs(temperature - lastTemperature) < 0.1) {
    return;
  }
  
  // 设置文本大小
  tft->setTextSize(2);
  
  // 根据阈值改变颜色
  if (temperature < tempThresholdMin || temperature > tempThresholdMax) {
    tft->setTextColor(ST7735_RED);
  } else {
    tft->setTextColor(ST7735_WHITE);
  }
  
  // 清除旧的温度值（在温度值区域绘制黑色矩形）
  tft->fillRect(40, 45, 60, 20, ST7735_BLACK);
  
  // 显示新的温度值
  tft->setCursor(40, 50);
  tft->print(temperature, 1);
}

void TFTDisplay::updateHumidity(float humidity) {
  // 如果湿度没有变化，则不更新
  if (abs(humidity - lastHumidity) < 0.1) {
    return;
  }
  
  // 设置文本大小
  tft->setTextSize(2);
  
  // 根据阈值改变颜色
  if (humidity < humThresholdMin || humidity > humThresholdMax) {
    tft->setTextColor(ST7735_RED);
  } else {
    tft->setTextColor(ST7735_WHITE);
  }
  
  // 清除旧的湿度值（在湿度值区域绘制黑色矩形）
  tft->fillRect(40, 95, 60, 20, ST7735_BLACK);
  
  // 显示新的湿度值
  tft->setCursor(40, 100);
  tft->print(humidity, 1);
}

void TFTDisplay::displayMessage(String message, uint16_t color) {
  tft->fillRect(0, 60, 160, 20, ST7735_BLACK);
  tft->setCursor(5, 70);
  tft->setTextColor(color);
  tft->setTextSize(1);
  tft->print(message);
}

void TFTDisplay::updateThresholds(float tempMin, float tempMax, float humMin, float humMax) {
  tempThresholdMin = tempMin;
  tempThresholdMax = tempMax;
  humThresholdMin = humMin;
  humThresholdMax = humMax;
}

void TFTDisplay::toggleThresholdDisplay() {
  showThresholds = !showThresholds;
}

void TFTDisplay::drawHeader() {
  tft->fillRect(0, 0, 160, 20, ST7735_BLUE);
  tft->setCursor(30, 5);
  tft->setTextColor(ST7735_WHITE);
  tft->setTextSize(1);
  tft->print("ENV MONITOR");
}

void TFTDisplay::drawFooter(String status) {
  tft->fillRect(0, 140, 160, 20, ST7735_BLUE);
  tft->setCursor(5, 145);
  tft->setTextColor(ST7735_WHITE);
  tft->setTextSize(1);
  tft->print(status);
}