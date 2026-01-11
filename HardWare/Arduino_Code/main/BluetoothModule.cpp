#include "BluetoothModule.h"

BluetoothModule::BluetoothModule(uint8_t rxPin, uint8_t txPin, long baudRate) {
  btSerial = new SoftwareSerial(rxPin, txPin);
  btSerial->begin(baudRate);
  isConnected = false;
}

void BluetoothModule::begin() {
  // 发送初始化消息
  sendResponse("READY");
}

void BluetoothModule::sendData(String data) {
  if (btSerial) {
    btSerial->println(data);
    btSerial->flush();  // 确保数据立即发送
  }
}

void BluetoothModule::sendData(float temperature, float humidity) {
  // 优化数据格式，减少传输字节
  String data = "D:" + String(temperature, 1) + "," + String(humidity, 1);
  sendData(data);
}

bool BluetoothModule::checkCommand() {
  while (btSerial->available()) {
    char c = btSerial->read();
    if (c == '\n') {
      receivedCommand.trim();
      if (receivedCommand.length() > 0) {
        return true;
      }
      receivedCommand = "";
    } else {
      receivedCommand += c;
    }
  }
  return false;
}

String BluetoothModule::getCommand() {
  return receivedCommand;
}

void BluetoothModule::sendResponse(String response) {
  btSerial->println("RESP:" + response);
  btSerial->flush();  // 确保数据立即发送
}

bool BluetoothModule::connectionStatus() {
  return isConnected;
}

void BluetoothModule::updateConnectionStatus(bool status) {
  isConnected = status;
  if (status) {
    sendResponse("CONNECTED");
  } else {
    sendResponse("DISCONNECTED");
  }
}