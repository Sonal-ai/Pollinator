#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <RTClib.h>
#include <NimBLEDevice.h>
#include <esp_timer.h>
#include <atomic>
#include <algorithm>
#include <cmath>
#include <ctime>
#include "src/honeychain/esp_platform.hpp"

// Reference wiring for a classic ESP32 DevKit. Review against the actual board before connecting hardware.
#ifndef HC_SENSOR_SIMULATION
#define HC_SENSOR_SIMULATION 0
#endif
constexpr int kSdaPin = 21, kSclPin = 22, kScaleDataPin = 32, kScaleClockPin = 33;
constexpr uint32_t kSampleInterval = 300000;
constexpr const char* kServiceUuid = "7f6a1000-8e54-4d80-b8e4-9b732f6c4a01";
constexpr const char* kTelemetryUuid = "7f6a1001-8e54-4d80-b8e4-9b732f6c4a01";
constexpr const char* kCommandUuid = "7f6a1002-8e54-4d80-b8e4-9b732f6c4a01";
constexpr uint16_t kNoConnection = 0xffff;
using namespace honeychain;
EspCrypto deviceCrypto; EspStore deviceStore; Journal journal(deviceStore, deviceCrypto);
Adafruit_BME280 climate; RTC_DS3231 rtc;
bool climatePresent = false, rtcPresent = false; uint8_t climateAddress = 0;
double scaleOffset = 0, scaleCounts = 0; bool calibratedScale = false;
uint64_t clockBase = 0, clockStarted = 0; bool softwareClock = false;
std::atomic<uint16_t> connection{kNoConnection}; std::atomic<uint32_t> generation{0};
std::atomic<uint32_t> securityStarted{0};
std::atomic<bool> encrypted{false}, subscribed{false};
NimBLECharacteristic* telemetry = nullptr; NimBLEServer* bleServer = nullptr;
struct Command { uint32_t generation; uint16_t connection; char text[4097]; };
QueueHandle_t commands = nullptr;
std::string receiveBuffer, transmitBuffer, serialBuffer, usbRequestId; size_t transmitOffset = 0;
bool serialDiscarding = false;
uint32_t transmitGeneration = 0, transmitStarted = 0, lastNotification = 0, cursorGeneration = 0;
uint32_t lastSampleAt = 0; bool sampled = false;
Cursor cursor; std::string sampleStatus = "NOT_SAMPLED", bluetoothStatus = "NOT_STARTED";
portMUX_TYPE scaleMux = portMUX_INITIALIZER_UNLOCKED;

bool i2cPresent(uint8_t address) { Wire.beginTransmission(address); return Wire.endTransmission() == 0; }
bool rawScale(int32_t& output) {
  if (digitalRead(kScaleDataPin) != LOW) return false;
  portENTER_CRITICAL(&scaleMux);
  if (digitalRead(kScaleDataPin) != LOW) { portEXIT_CRITICAL(&scaleMux); return false; }
  uint32_t bits = 0;
  for (uint8_t bit = 0; bit < 24; ++bit) {
    digitalWrite(kScaleClockPin, HIGH); delayMicroseconds(1);
    bits = (bits << 1) | (digitalRead(kScaleDataPin) == HIGH ? 1U : 0U);
    digitalWrite(kScaleClockPin, LOW); delayMicroseconds(1);
  }
  // One final clock chooses channel A, gain 128 for the next conversion.
  digitalWrite(kScaleClockPin, HIGH); delayMicroseconds(1); digitalWrite(kScaleClockPin, LOW); delayMicroseconds(1);
  portEXIT_CRITICAL(&scaleMux);
  output = (bits & 0x800000U) ? static_cast<int32_t>(bits) - 0x1000000 : static_cast<int32_t>(bits);
  return true;
}
bool currentTime(std::string& result) {
  uint64_t seconds = 0;
  if (rtcPresent && i2cPresent(0x68) && !rtc.lostPower()) {
    const DateTime now = rtc.now(); if (now.year() >= 2024 && now.year() <= 2099) seconds = now.unixtime();
  }
  if (!seconds && softwareClock) seconds = clockBase + (static_cast<uint64_t>(esp_timer_get_time()) - clockStarted) / 1000000;
  if (!seconds) return false;
  const time_t timestamp = static_cast<time_t>(seconds); struct tm utc{}; char text[24];
  if (!gmtime_r(&timestamp, &utc) || !strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &utc)) return false;
  result = text; return utcTimestamp(result);
}
void measured(JsonObject metrics, const char* name, double value, double minimum, double maximum) {
  if (std::isfinite(value) && value >= minimum && value <= maximum) metrics[name] = value;
}
void captureSample() {
  if (!journal.ready()) { sampleStatus = errorName(journal.fault()); return; }
  std::string time; if (!currentTime(time)) { sampleStatus = "CLOCK_REQUIRED"; return; }
  JsonDocument document; JsonObject metrics = document.to<JsonObject>();
#if HC_SENSOR_SIMULATION
  if (journal.source() != "SIMULATED") { sampleStatus = "SIMULATION_REQUIRES_SIMULATED_ENROLLMENT"; return; }
  metrics["tempC"] = 35.0; metrics["humidityPct"] = 55.0; metrics["weightKg"] = 42.0;
#else
  if (climatePresent && i2cPresent(climateAddress)) {
    measured(metrics, "tempC", climate.readTemperature(), -20, 70);
    measured(metrics, "humidityPct", climate.readHumidity(), 0, 100);
    measured(metrics, "pressureHPa", climate.readPressure() / 100.0, 800, 1100);
  }
  int32_t raw;
  if (calibratedScale && rawScale(raw) && raw != -8388608 && raw != 8388607) {
    measured(metrics, "weightKg", (static_cast<double>(raw) - scaleOffset) / scaleCounts, 0, 500);
  }
#endif
  if (!metrics.size()) { sampleStatus = "NO_VALID_MEASUREMENTS"; return; }
  const Result result = journal.capture(metrics, time); sampleStatus = errorName(result.error);
}
void disconnectPhone() {
  const uint16_t handle = connection.exchange(kNoConnection);
  encrypted = false; subscribed = false; ++generation;
  if (handle != kNoConnection && bleServer) bleServer->disconnect(handle);
}
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& info) override {
    uint16_t expected = kNoConnection;
    if (!connection.compare_exchange_strong(expected, info.getConnHandle())) { server->disconnect(info.getConnHandle()); return; }
    encrypted = false; subscribed = false; securityStarted = millis(); ++generation; receiveBuffer.clear();
    server->updateConnParams(info.getConnHandle(), 24, 48, 0, 180);
    NimBLEDevice::startSecurity(info.getConnHandle());
  }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo& info, int) override {
    if (connection == info.getConnHandle()) { connection = kNoConnection; encrypted = false; subscribed = false; ++generation; receiveBuffer.clear(); }
    NimBLEDevice::startAdvertising();
  }
  void onAuthenticationComplete(NimBLEConnInfo& info) override {
    if (connection != info.getConnHandle()) return;
    if (!info.isEncrypted() || !info.isAuthenticated()) { disconnectPhone(); return; }
    encrypted = true;
  }
} serverCallbacks;
class CharacteristicCallbacks : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic*, NimBLEConnInfo& info, uint16_t value) override {
    if (connection == info.getConnHandle()) subscribed = (value & 1U) != 0;
  }
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& info) override {
    if (connection != info.getConnHandle() || !info.isEncrypted() || !info.isAuthenticated()) { disconnectPhone(); return; }
    const auto value = characteristic->getValue();
    for (size_t i = 0; i < value.size(); ++i) {
      const unsigned char c = value.data()[i];
      if (c == '\n') {
        if (receiveBuffer.empty()) continue;
        pendingCommand_.generation = generation.load(); pendingCommand_.connection = info.getConnHandle();
        memcpy(pendingCommand_.text, receiveBuffer.data(), receiveBuffer.size());
        pendingCommand_.text[receiveBuffer.size()] = '\0'; receiveBuffer.clear();
        if (xQueueSend(commands, &pendingCommand_, 0) != pdTRUE) { disconnectPhone(); return; }
      } else {
        if (c > 127 || (c < 32 && c != '\r' && c != '\t') || receiveBuffer.size() >= 4096) { receiveBuffer.clear(); disconnectPhone(); return; }
        receiveBuffer.push_back(static_cast<char>(c));
      }
    }
  }
 private:
  // NimBLE invokes GATT callbacks on its host task. Keep this large frame off that task's stack.
  Command pendingCommand_{};
} characteristicCallbacks;
void startBluetooth() {
  if (!journal.ready()) return;
  uint32_t pin; if (!journal.pairingCode(pin)) return;
  if (!NimBLEDevice::init(journal.deviceId())) { bluetoothStatus = "BLE_INIT_FAILED"; return; }
  // Bonded phones must not retain access after a credential epoch changes.
  std::string bondedEpoch;
  const Read binding = deviceStore.readBondEpoch(bondedEpoch);
  if (binding == Read::Failed || ((binding == Read::Missing || bondedEpoch != journal.epoch())
      && (!NimBLEDevice::deleteAllBonds() || !deviceStore.writeBondEpoch(journal.epoch())))) {
    bluetoothStatus = "BLE_PAIRING_STATE_ERROR"; return;
  }
  NimBLEDevice::setSecurityAuth(true, true, true);
  NimBLEDevice::setSecurityIOCap(BLE_HS_IO_DISPLAY_ONLY);
  NimBLEDevice::setSecurityPasskey(pin);
  bleServer = NimBLEDevice::createServer(); bleServer->setCallbacks(&serverCallbacks);
  NimBLEService* service = bleServer->createService(kServiceUuid);
  telemetry = service->createCharacteristic(kTelemetryUuid, NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC | NIMBLE_PROPERTY::READ_AUTHEN, 20);
  telemetry->setCallbacks(&characteristicCallbacks);
  NimBLECharacteristic* command = service->createCharacteristic(kCommandUuid, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN, 20);
  command->setCallbacks(&characteristicCallbacks); service->start();
  auto* advertising = NimBLEDevice::getAdvertising(); advertising->addServiceUUID(kServiceUuid); advertising->enableScanResponse(true); advertising->setName(journal.deviceId());
  bluetoothStatus = advertising->start() ? "BLE_READY" : "BLE_ADVERTISING_FAILED";
}
void processBluetooth() {
  const uint32_t activeGeneration = generation.load();
  if (cursorGeneration != activeGeneration) { cursorGeneration = activeGeneration; cursor = {}; transmitBuffer.clear(); transmitOffset = 0; }
  if (connection == kNoConnection) return;
  if (!encrypted) { if (millis() - securityStarted.load() > 30000) disconnectPhone(); return; }
  if (!subscribed) return;
  if (!transmitBuffer.empty()) {
    if (millis() - transmitStarted > 10000) { disconnectPhone(); return; }
    if (transmitGeneration != activeGeneration || millis() - lastNotification < 15) return;
    const size_t count = std::min<size_t>(20, transmitBuffer.size() - transmitOffset);
    const uint16_t handle = connection.load();
    if (handle == kNoConnection || generation.load() != transmitGeneration || !encrypted || !subscribed) return;
    if (telemetry->notify(reinterpret_cast<const uint8_t*>(transmitBuffer.data() + transmitOffset), count, handle)) {
      transmitOffset += count; lastNotification = millis();
      if (transmitOffset == transmitBuffer.size()) { transmitBuffer.clear(); transmitOffset = 0; }
    }
    return;
  }
  // Only the Arduino loop consumes this slot; the queue copies from the separate BLE callback slot.
  static Command command{}; if (xQueueReceive(commands, &command, 0) != pdTRUE) return;
  if (command.generation != activeGeneration || command.connection != connection) return;
  JsonDocument request;
  if (!parseObject(request, command.text, 4)) { disconnectPhone(); return; }
  const std::string action = jsonString(request["command"]); Result result;
  if ((action == "rewind" || action == "next") && onlyKeys(request.as<JsonObjectConst>(), {"command"})) {
    if (action == "rewind") cursor = {};
    result = journal.next(cursor, transmitBuffer);
    if (result) { transmitBuffer.push_back('\n'); transmitGeneration = activeGeneration; transmitStarted = millis(); lastNotification = 0; }
  } else if (action == "ack" && onlyKeys(request.as<JsonObjectConst>(), {"command", "receipt"})
      && onlyKeys(request["receipt"].as<JsonObjectConst>(), {"payload", "signature"})) {
    result = journal.acknowledge(jsonString(request["receipt"]["payload"]), jsonString(request["receipt"]["signature"]));
  } else result = {Error::InvalidInput};
  if (!result) disconnectPhone();
}
void serialReply(bool okay, const char* code) {
  JsonDocument response; response["ok"] = okay; response["code"] = code; if (!usbRequestId.empty()) response["requestId"] = usbRequestId;
  serializeJson(response, Serial); Serial.println();
}
void handleSerial(const std::string& line) {
  JsonDocument request;
  if (!parseObject(request, line, 4)) { serialReply(false, "INVALID_COMMAND"); return; }
  if (!request["requestId"].isNull()) {
    usbRequestId = jsonString(request["requestId"]);
    bool valid = usbRequestId.size() == 16;
    for (char c : usbRequestId) if (!(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f')) valid = false;
    if (!valid) { usbRequestId.clear(); serialReply(false, "INVALID_REQUEST_ID"); return; }
    request.remove("requestId");
  }
  const std::string action = jsonString(request["command"]);
  if (action == "status" && onlyKeys(request.as<JsonObjectConst>(), {"command"})) {
    JsonDocument response; response["ok"] = true; response["code"] = errorName(journal.fault()); response["requestId"] = usbRequestId; response["deviceId"] = journal.deviceId();
    response["epoch"] = journal.epoch(); response["source"] = journal.source(); response["pending"] = journal.pending(); response["nextSequence"] = journal.nextSequence();
    response["filesystemReady"] = deviceStore.filesystemReady(); response["sampleStatus"] = sampleStatus; response["bluetoothStatus"] = bluetoothStatus; response["climatePresent"] = climatePresent; response["scaleCalibrated"] = calibratedScale;
    std::string now; response["clockReady"] = currentTime(now); if (!now.empty()) response["clockUtc"] = now; serializeJson(response, Serial); Serial.println();
  } else if (action == "provision" && onlyKeys(request.as<JsonObjectConst>(), {"command", "identity"})) {
    disconnectPhone(); const Result result = journal.provision(request["identity"].as<JsonObjectConst>()); serialReply(static_cast<bool>(result), errorName(result.error));
    if (result) { delay(100); ESP.restart(); }
  } else if (action == "format" && onlyKeys(request.as<JsonObjectConst>(), {"command", "confirm"}) && jsonString(request["confirm"]) == "ERASE_ALL_LOCAL_READINGS") {
    disconnectPhone();
    if (!deviceStore.formatAfterExplicitConfirmation()) { serialReply(false, "FORMAT_FAILED"); return; }
    const Result result = journal.configured() ? journal.rebindAfterExplicitErase() : journal.begin();
    serialReply(result || result.error == Error::Unprovisioned, errorName(result.error)); delay(100); ESP.restart();
  } else if (action == "set-time" && onlyKeys(request.as<JsonObjectConst>(), {"command", "unixSeconds"}) && request["unixSeconds"].is<uint32_t>()) {
    const uint32_t seconds = request["unixSeconds"].as<uint32_t>();
    if (seconds < 1704067200U || seconds > 4102444799U) { serialReply(false, "INVALID_CLOCK"); return; }
    clockBase = seconds; clockStarted = esp_timer_get_time(); softwareClock = true;
    if (rtcPresent && i2cPresent(0x68)) rtc.adjust(DateTime(seconds));
    serialReply(true, "CLOCK_SET");
  } else if (action == "set-scale" && onlyKeys(request.as<JsonObjectConst>(), {"command", "tareOffset", "countsPerKg"}) && request["tareOffset"].is<int32_t>() && request["countsPerKg"].is<double>()) {
    calibratedScale = deviceStore.writeScale(request["tareOffset"].as<int32_t>(), request["countsPerKg"].as<double>()) && deviceStore.readScale(scaleOffset, scaleCounts);
    serialReply(calibratedScale, calibratedScale ? "SCALE_SET" : "INVALID_SCALE");
  } else if (action == "raw-scale" && onlyKeys(request.as<JsonObjectConst>(), {"command"})) {
    int32_t raw; JsonDocument response; const bool available = rawScale(raw); response["ok"] = available; response["code"] = available ? "RAW_SCALE" : "SCALE_UNAVAILABLE"; response["requestId"] = usbRequestId; if (available) response["raw"] = raw;
    serializeJson(response, Serial); Serial.println();
  } else if (action == "pairing-code" && onlyKeys(request.as<JsonObjectConst>(), {"command"})) {
    uint32_t pin; const Result result = journal.pairingCode(pin); JsonDocument response; response["ok"] = static_cast<bool>(result); response["code"] = errorName(result.error); response["requestId"] = usbRequestId; if (result) response["pairingCode"] = pin;
    serializeJson(response, Serial); Serial.println();
  } else if (action == "sample" && onlyKeys(request.as<JsonObjectConst>(), {"command"})) {
    captureSample(); serialReply(sampleStatus == "OK", sampleStatus.c_str()); sampled = true; lastSampleAt = millis();
  } else serialReply(false, "INVALID_COMMAND");
}
void setup() {
  Serial.begin(115200); commands = xQueueCreate(8, sizeof(Command));
  if (!commands) { serialReply(false, "COMMAND_QUEUE_UNAVAILABLE"); return; }
  Wire.begin(kSdaPin, kSclPin); Wire.setTimeOut(50);
  pinMode(kScaleDataPin, INPUT_PULLUP); pinMode(kScaleClockPin, OUTPUT); digitalWrite(kScaleClockPin, LOW);
  if (climate.begin(0x76, &Wire)) { climatePresent = true; climateAddress = 0x76; }
  else if (climate.begin(0x77, &Wire)) { climatePresent = true; climateAddress = 0x77; }
  rtcPresent = rtc.begin(&Wire); deviceStore.begin(); calibratedScale = deviceStore.readScale(scaleOffset, scaleCounts);
  const Result result = journal.begin(); serialReply(static_cast<bool>(result), errorName(result.error)); startBluetooth();
}
void loop() {
  while (Serial.available()) {
    const unsigned char c = Serial.read();
    if (c == '\n') { if (!serialDiscarding && !serialBuffer.empty()) handleSerial(serialBuffer); serialBuffer.clear(); usbRequestId.clear(); serialDiscarding = false; }
    else if (serialDiscarding) {}
    else if (c == '\r') {} // USB tools may use CRLF; BLE remains newline framed.
    else if (c < 32 || c > 127 || serialBuffer.size() >= 2048) { serialBuffer.clear(); serialDiscarding = true; serialReply(false, "USB_FRAME_TOO_LARGE"); }
    else serialBuffer.push_back(static_cast<char>(c));
  }
  processBluetooth();
  if (!sampled || millis() - lastSampleAt >= kSampleInterval) { sampled = true; lastSampleAt = millis(); captureSample(); }
  delay(1);
}
