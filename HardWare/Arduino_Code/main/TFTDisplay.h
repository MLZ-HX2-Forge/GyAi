#ifndef TFTDISPLAY_H
#define TFTDISPLAY_H

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

class TFTDisplay {
  private:
    Adafruit_ST7735* tft;
    float tempThresholdMin = 18.0;
    float tempThresholdMax = 30.0;
    float humThresholdMin = 30.0;
    float humThresholdMax = 80.0;
    bool showThresholds = false;
    
    // 上次显示的值，用于局部更新
    float lastTemperature = -100.0;
    float lastHumidity = -100.0;
    
  public:
    TFTDisplay(uint8_t cs, uint8_t dc, uint8_t rst, uint8_t sclk, uint8_t mosi);
    void begin();
    void clearScreen();
    void displayData(float temperature, float humidity);
    void displayStaticElements();  // 显示静态元素
    void updateTemperature(float temperature);  // 只更新温度
    void updateHumidity(float humidity);  // 只更新湿度
    void displayMessage(String message, uint16_t color = ST7735_WHITE);
    void updateThresholds(float tempMin, float tempMax, float humMin, float humMax);
    void toggleThresholdDisplay();
    void drawHeader();
    void drawFooter(String status);
    void clearDataArea();  // 清除数据显示区域
};

#endif