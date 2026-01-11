#ifndef BLUETOOTHMODULE_H
#define BLUETOOTHMODULE_H

#include <SoftwareSerial.h>

class BluetoothModule {
  private:
    SoftwareSerial* btSerial;
    String receivedCommand;
    bool isConnected;
    
  public:
    BluetoothModule(uint8_t rxPin, uint8_t txPin, long baudRate = 9600);
    void begin();
    void sendData(String data);
    void sendData(float temperature, float humidity);
    bool checkCommand();
    String getCommand();
    void sendResponse(String response);
    bool connectionStatus();
    void updateConnectionStatus(bool status);
};

#endif