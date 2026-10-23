#pragma once
#define ARDUINOJSON_ENABLE_STD_STRING 1
#include <ArduinoJson.h>
#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace honeychain {
constexpr uint32_t kSequenceEnd = 2147483648U;
constexpr size_t kMaximumPackets = 2048;
constexpr size_t kMaximumWireBytes = 8192;
using Digest = std::array<uint8_t, 32>;
enum class Read { Missing, Okay, Failed };
enum class Error { None, Unprovisioned, InvalidInput, Storage, CorruptState, CorruptJournal, WrongIdentity,
                   PendingRotation, Full, Exhausted, InvalidReceipt, Crypto };
struct Result {
  Error error = Error::None;
  explicit operator bool() const { return error == Error::None; }
};
const char* errorName(Error value);
class Crypto {
 public:
  virtual ~Crypto() = default;
  virtual bool sha256(const std::string& bytes, Digest& out) = 0;
  virtual bool hmac(const Digest& key, const std::string& bytes, Digest& out) = 0;
};
class Store {
 public:
  virtual ~Store() = default;
  virtual Read readState(std::string& value) = 0;
  virtual bool writeState(const std::string& value) = 0;
  virtual Read readOwner(std::string& value) = 0;
  virtual bool writeOwner(const std::string& value) = 0;
  virtual bool list(std::vector<uint32_t>& sequences) = 0;
  virtual Read readPacket(uint32_t sequence, std::string& value) = 0;
  virtual bool putPacket(uint32_t sequence, const std::string& value) = 0;
  virtual bool erasePacket(uint32_t sequence) = 0;
  virtual bool hasSpace(size_t bytes) = 0;
  virtual void cooperate() {}
};
struct Identity {
  std::string deviceId, epoch, secret, source;
  uint32_t reservedUntil = 0;
};
struct Cursor { bool started = false; uint32_t after = 0; };
std::string base64Encode(const std::string& value);
bool base64Decode(const std::string& value, size_t maximum, std::string& result);
bool utcTimestamp(const std::string& value);
bool hexDecode(const std::string& value, Digest& result);
std::string hexEncode(const Digest& value);
bool onlyKeys(JsonObjectConst value, std::initializer_list<const char*> names);
bool parseObject(JsonDocument& document, const std::string& bytes, uint8_t nestingLimit = 4);
std::string jsonString(JsonVariantConst value);

class Journal {
 public:
  Journal(Store& store, Crypto& crypto) : store_(store), crypto_(crypto) {}
  Result begin();
  Result provision(JsonObjectConst identity);
  Result capture(JsonObjectConst metrics, const std::string& observedAt);
  Result next(Cursor& cursor, std::string& wire);
  Result acknowledge(const std::string& payload, const std::string& signature);
  Result rebindAfterExplicitErase();
  Result pairingCode(uint32_t& pin);
  bool configured() const { return configured_; }
  bool ready() const { return configured_ && fault_ == Error::None; }
  Error fault() const { return fault_; }
  size_t pending() const { return sequences_.size(); }
  uint32_t nextSequence() const { return next_; }
  const std::string& deviceId() const { return identity_.deviceId; }
  const std::string& epoch() const { return identity_.epoch; }
  const std::string& source() const { return identity_.source; }
 private:
  Store& store_; Crypto& crypto_; Identity identity_;
  std::vector<uint32_t> sequences_;
  uint32_t next_ = 0, blockEnd_ = 0;
  bool configured_ = false;
  Error fault_ = Error::Unprovisioned;
  Result fail(Error value) { fault_ = value; return {value}; }
  Result persist(const Identity& identity);
  Result ownerValue(std::string& value);
  bool mac(const std::string& domain, const std::string& value, Digest& out);
  Result validateEnvelope(const std::string& envelope, uint32_t sequence, std::string* raw = nullptr);
};
}
