#pragma once
#include "core.hpp"
#include <Arduino.h>
#include <LittleFS.h>
#include <nvs.h>
#include <mbedtls/md.h>
#include <cstdio>
#include <cmath>

namespace honeychain {
class EspCrypto : public Crypto {
 public:
  bool sha256(const std::string& value, Digest& out) override {
    const auto* algorithm = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    return algorithm && mbedtls_md(algorithm, reinterpret_cast<const unsigned char*>(value.data()), value.size(), out.data()) == 0;
  }
  bool hmac(const Digest& key, const std::string& value, Digest& out) override {
    const auto* algorithm = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    return algorithm && mbedtls_md_hmac(algorithm, key.data(), key.size(), reinterpret_cast<const unsigned char*>(value.data()), value.size(), out.data()) == 0;
  }
};
class EspStore : public Store {
 public:
  bool begin() {
    nvsReady_ = nvs_open("honeychain", NVS_READWRITE, &nvs_) == ESP_OK;
    fsReady_ = LittleFS.begin(false); // Never erase pending readings because a mount failed.
    if (fsReady_) fsReady_ = LittleFS.exists("/journal") || LittleFS.mkdir("/journal");
    return nvsReady_ && fsReady_;
  }
  bool filesystemReady() const { return fsReady_; }
  bool formatAfterExplicitConfirmation() {
    LittleFS.end(); fsReady_ = false;
    if (!LittleFS.format() || !LittleFS.begin(false) || !LittleFS.mkdir("/journal")) return false;
    fsReady_ = true; return true;
  }
  Read readState(std::string& value) override {
    if (!nvsReady_) return Read::Failed;
    size_t length = 0; const esp_err_t status = nvs_get_blob(nvs_, "state", nullptr, &length);
    if (status == ESP_ERR_NVS_NOT_FOUND) return Read::Missing;
    if (status != ESP_OK || length == 0 || length > 2048) return Read::Failed;
    value.resize(length);
    return nvs_get_blob(nvs_, "state", &value[0], &length) == ESP_OK ? Read::Okay : Read::Failed;
  }
  bool writeState(const std::string& value) override {
    if (!nvsReady_ || value.size() > 2048 || nvs_set_blob(nvs_, "state", value.data(), value.size()) != ESP_OK || nvs_commit(nvs_) != ESP_OK) return false;
    std::string actual; return readState(actual) == Read::Okay && actual == value;
  }
  Read readOwner(std::string& value) override { return readFile("/hc.owner", 128, value); }
  bool writeOwner(const std::string& value) override { return writeFile("/hc.owner", value, true); }
  Read readPacket(uint32_t sequence, std::string& value) override { return readFile(packetPath(sequence), kMaximumWireBytes, value); }
  bool putPacket(uint32_t sequence, const std::string& value) override { return writeFile(packetPath(sequence), value, false); }
  bool erasePacket(uint32_t sequence) override { return fsReady_ && LittleFS.remove(packetPath(sequence).c_str()); }
  bool hasSpace(size_t bytes) override {
    if (!fsReady_) return false;
    const size_t total = LittleFS.totalBytes(), used = LittleFS.usedBytes();
    return total >= used && total - used >= bytes + 16384;
  }
  void cooperate() override { delay(1); }
  Read readBondEpoch(std::string& epoch) {
    if (!nvsReady_) return Read::Failed;
    size_t length = 0; const esp_err_t status = nvs_get_str(nvs_, "ble_epoch", nullptr, &length);
    if (status == ESP_ERR_NVS_NOT_FOUND) return Read::Missing;
    if (status != ESP_OK || length != 37) return Read::Failed;
    char value[37]{};
    if (nvs_get_str(nvs_, "ble_epoch", value, &length) != ESP_OK || value[36] != '\0') return Read::Failed;
    epoch.assign(value, 36); return Read::Okay;
  }
  bool writeBondEpoch(const std::string& epoch) {
    if (!nvsReady_ || epoch.size() != 36 || nvs_set_str(nvs_, "ble_epoch", epoch.c_str()) != ESP_OK || nvs_commit(nvs_) != ESP_OK) return false;
    std::string actual; return readBondEpoch(actual) == Read::Okay && actual == epoch;
  }
  bool list(std::vector<uint32_t>& sequences) override {
    sequences.clear(); if (!fsReady_) return false;
    File directory = LittleFS.open("/journal"); if (!directory || !directory.isDirectory()) return false;
    for (File entry = directory.openNextFile(); entry; entry = directory.openNextFile()) {
      if (entry.isDirectory()) return false;
      std::string name = entry.name(); const size_t slash = name.find_last_of('/'); if (slash != std::string::npos) name = name.substr(slash + 1);
      entry.close();
      if ((name.size() != 12 || name.substr(8) != ".pkt") && (name.size() != 16 || name.substr(8) != ".pkt.tmp")) return false;
      uint32_t sequence = 0;
      for (size_t i = 0; i < 8; ++i) {
        const char c = name[i]; const int digit = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1;
        if (digit < 0) return false;
        sequence = (sequence << 4) | static_cast<uint32_t>(digit);
      }
      if (sequence >= kSequenceEnd) return false;
      if (name.size() == 16) { if (!LittleFS.remove(("/journal/" + name).c_str())) return false; }
      else { sequences.push_back(sequence); if (sequences.size() > kMaximumPackets) return false; }
      cooperate();
    }
    return true;
  }
  bool readScale(double& offset, double& countsPerKg) {
    if (!nvsReady_) return false;
    size_t size = 0; if (nvs_get_blob(nvs_, "scale", nullptr, &size) != ESP_OK || size == 0 || size > 512) return false;
    std::string encoded(size, '\0'); if (nvs_get_blob(nvs_, "scale", &encoded[0], &size) != ESP_OK) return false;
    JsonDocument wrapper, calibration; std::string raw; Digest expected, actual; EspCrypto crypto;
    if (!parseObject(wrapper, encoded) || !onlyKeys(wrapper.as<JsonObjectConst>(), {"payload", "sha256"})
        || !base64Decode(jsonString(wrapper["payload"]), 256, raw) || !hexDecode(jsonString(wrapper["sha256"]), expected)
        || !crypto.sha256(raw, actual) || expected != actual || !parseObject(calibration, raw)
        || !onlyKeys(calibration.as<JsonObjectConst>(), {"offset", "countsPerKg"}) || !calibration["offset"].is<int32_t>() || !calibration["countsPerKg"].is<double>()) return false;
    offset = calibration["offset"].as<int32_t>(); countsPerKg = calibration["countsPerKg"].as<double>();
    return std::isfinite(countsPerKg) && std::abs(countsPerKg) >= 1.0 && std::abs(countsPerKg) <= 1e9;
  }
  bool writeScale(int32_t offset, double countsPerKg) {
    if (!nvsReady_ || !std::isfinite(countsPerKg) || std::abs(countsPerKg) < 1.0 || std::abs(countsPerKg) > 1e9) return false;
    JsonDocument calibration; calibration["offset"] = offset; calibration["countsPerKg"] = countsPerKg;
    std::string raw; serializeJson(calibration, raw); Digest hash; EspCrypto crypto;
    if (!crypto.sha256(raw, hash)) return false;
    JsonDocument wrapper; wrapper["payload"] = base64Encode(raw); wrapper["sha256"] = hexEncode(hash);
    std::string encoded; serializeJson(wrapper, encoded);
    if (nvs_set_blob(nvs_, "scale", encoded.data(), encoded.size()) != ESP_OK || nvs_commit(nvs_) != ESP_OK) return false;
    size_t storedSize = 0;
    if (nvs_get_blob(nvs_, "scale", nullptr, &storedSize) != ESP_OK || storedSize != encoded.size()) return false;
    std::string stored(storedSize, '\0');
    if (nvs_get_blob(nvs_, "scale", &stored[0], &storedSize) != ESP_OK || stored != encoded) return false;
    double savedOffset, savedCounts; return readScale(savedOffset, savedCounts) && savedOffset == offset;
  }
 private:
  nvs_handle_t nvs_ = 0; bool nvsReady_ = false, fsReady_ = false;
  static std::string packetPath(uint32_t sequence) { char path[32]; snprintf(path, sizeof(path), "/journal/%08lx.pkt", static_cast<unsigned long>(sequence)); return path; }
  Read readFile(const std::string& path, size_t maximum, std::string& value) {
    if (!fsReady_) return Read::Failed;
    if (!LittleFS.exists(path.c_str())) return Read::Missing;
    File file = LittleFS.open(path.c_str(), FILE_READ);
    if (!file || file.size() == 0 || file.size() > maximum) return Read::Failed;
    value.resize(file.size()); const size_t read = file.read(reinterpret_cast<uint8_t*>(&value[0]), value.size()); file.close();
    return read == value.size() ? Read::Okay : Read::Failed;
  }
  bool writeFile(const std::string& path, const std::string& value, bool replace) {
    if (!fsReady_ || (!replace && LittleFS.exists(path.c_str()))) return false;
    const std::string temporary = path + ".tmp";
    File file = LittleFS.open(temporary.c_str(), FILE_WRITE);
    if (!file) return false;
    const size_t written = file.write(reinterpret_cast<const uint8_t*>(value.data()), value.size()); file.flush(); file.close();
    std::string actual;
    if (written != value.size() || readFile(temporary, kMaximumWireBytes, actual) != Read::Okay || actual != value || !LittleFS.rename(temporary.c_str(), path.c_str())) return false;
    return readFile(path, kMaximumWireBytes, actual) == Read::Okay && actual == value;
  }
};
}
