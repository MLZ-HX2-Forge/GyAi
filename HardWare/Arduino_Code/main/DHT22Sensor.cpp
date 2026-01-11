#include "DHT22Sensor.h"

DHT22Sensor::DHT22Sensor(uint8_t pin, uint8_t type) : dht(pin, type) {
  temperature = 0.0;
  humidity = 0.0;
  isInitialized = false;
}

void DHT22Sensor::begin() {
  dht.begin();
  isInitialized = true;
  delay(1000); // 等待传感器稳定
}

bool DHT22Sensor::readData() {
  if (!isInitialized) return false;
  
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (isnan(h) || isnan(t)) {
    return false;
  }
  
  humidity = h;
  temperature = t;
  return true;
}

float DHT22Sensor::getTemperature() {
  return temperature;
}

float DHT22Sensor::getHumidity() {
  return humidity;
}

bool DHT22Sensor::isAvailable() {
  return isInitialized;
}

String DHT22Sensor::getFormattedData() {
  String data = "TEMP:" + String(temperature, 1) + 
                ",HUM:" + String(humidity, 1);
  return data;
}