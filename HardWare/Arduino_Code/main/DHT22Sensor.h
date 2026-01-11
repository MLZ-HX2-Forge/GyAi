#ifndef DHT22SENSOR_H
#define DHT22SENSOR_H

#include <DHT.h>

class DHT22Sensor {
  private:
    DHT dht;
    float temperature;
    float humidity;
    bool isInitialized;
    
  public:
    DHT22Sensor(uint8_t pin, uint8_t type = DHT22);
    void begin();
    bool readData();
    float getTemperature();
    float getHumidity();
    bool isAvailable();
    String getFormattedData();
};

#endif