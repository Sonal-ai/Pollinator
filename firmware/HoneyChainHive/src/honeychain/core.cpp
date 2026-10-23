#include "core.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace honeychain {
namespace {
const char* kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
constexpr const char* kTelemetryDomain = "honey-chain-telemetry-v1\n";
constexpr const char* kStoredDomain = "honey-chain-stored-v1\n";
std::string serialize(JsonDocument& document) { std::string result; serializeJson(document, result); return result; }
bool ascii(const std::string& value) { for (unsigned char c : value) if (c < 32 || c > 126) return false; return true; }
bool deviceId(const std::string& value) {
  if (value.size() < 3 || value.size() > 64) return false;
  for (size_t i = 0; i < value.size(); ++i) {
    const char c = value[i];
    if (!(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9') && !(i && (c == '-' || c == '_'))) return false;
  }
  return true;
}
bool uuid(const std::string& value) {
  if (value.size() != 36 || value[14] < '1' || value[14] > '8' || std::string("89ab").find(value[19]) == std::string::npos) return false;
  for (size_t i = 0; i < value.size(); ++i) {
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (value[i] != '-') return false; }
    else if (!((value[i] >= '0' && value[i] <= '9') || (value[i] >= 'a' && value[i] <= 'f'))) return false;
  }
  return true;
}
bool validIdentity(const Identity& identity) {
  Digest ignored;
  return deviceId(identity.deviceId) && uuid(identity.epoch) && hexDecode(identity.secret, ignored)
    && (identity.source == "DEVICE" || identity.source == "SIMULATED") && identity.reservedUntil <= kSequenceEnd;
}
bool equalDigest(const Digest& one, const Digest& two) {
  volatile uint8_t difference = 0;
  for (size_t i = 0; i < one.size(); ++i) difference = static_cast<uint8_t>(difference | (one[i] ^ two[i]));
  return difference == 0;
}
bool metricsValid(JsonObjectConst metrics) {
  if (metrics.isNull() || metrics.size() == 0 || metrics.size() > 5) return false;
  for (JsonPairConst pair : metrics) {
    const std::string name(pair.key().c_str(), pair.key().size());
    if (!pair.value().is<double>()) return false;
    const double value = pair.value().as<double>();
    if (!std::isfinite(value)) return false;
    if (name == "tempC") { if (value < -20 || value > 70) return false; }
    else if (name == "humidityPct" || name == "batteryPct") { if (value < 0 || value > 100) return false; }
    else if (name == "weightKg") { if (value < 0 || value > 500) return false; }
    else if (name == "pressureHPa") { if (value < 800 || value > 1100) return false; }
    else return false;
  }
  return true;
}
}
const char* errorName(Error value) {
  switch (value) {
    case Error::None: return "OK"; case Error::Unprovisioned: return "UNPROVISIONED";
    case Error::InvalidInput: return "INVALID_INPUT"; case Error::Storage: return "STORAGE_ERROR";
    case Error::CorruptState: return "STATE_CORRUPT"; case Error::CorruptJournal: return "JOURNAL_CORRUPT";
    case Error::WrongIdentity: return "IDENTITY_MISMATCH"; case Error::PendingRotation: return "PENDING_READINGS_PREVENT_ROTATION";
    case Error::Full: return "JOURNAL_FULL"; case Error::Exhausted: return "NEW_EPOCH_REQUIRED";
    case Error::InvalidReceipt: return "INVALID_RECEIPT"; case Error::Crypto: return "CRYPTO_ERROR";
  }
  return "UNKNOWN_ERROR";
}
std::string jsonString(JsonVariantConst value) {
  if (!value.is<const char*>()) return {};
  const JsonString text = value.as<JsonString>();
  return std::string(text.c_str(), text.size());
}
bool onlyKeys(JsonObjectConst value, std::initializer_list<const char*> names) {
  if (value.isNull() || value.size() != names.size()) return false;
  for (JsonPairConst pair : value) {
    const std::string key(pair.key().c_str(), pair.key().size()); bool found = false;
    for (const char* name : names) if (key == name) { found = true; break; }
    if (!found) return false;
  }
  return true;
}
bool parseObject(JsonDocument& document, const std::string& bytes, uint8_t nestingLimit) {
  bool quoted = false, escaped = false, started = false, ended = false; unsigned depth = 0;
  for (unsigned char c : bytes) {
    if (ended || !started) {
      if (c == ' ' || c == '\t' || c == '\r' || c == '\n') continue;
      if (ended || c != '{') return false;
      started = true; depth = 1; continue;
    }
    if (quoted) {
      if (c < 32) return false;
      if (escaped) escaped = false;
      else if (c == '\\') escaped = true;
      else if (c == '"') quoted = false;
    } else if (c == '"') quoted = true;
    else if (c == '{' || c == '[') { if (++depth > nestingLimit) return false; }
    else if (c == '}' || c == ']') { if (!depth || --depth == 0) ended = true; }
  }
  return started && ended && !quoted && !deserializeJson(document, bytes, DeserializationOption::NestingLimit(nestingLimit)) && document.is<JsonObject>();
}
std::string hexEncode(const Digest& value) {
  static const char* alphabet = "0123456789abcdef"; std::string result; result.reserve(64);
  for (uint8_t byte : value) { result.push_back(alphabet[byte >> 4]); result.push_back(alphabet[byte & 15]); }
  return result;
}
bool hexDecode(const std::string& value, Digest& result) {
  if (value.size() != 64) return false;
  auto digit = [](char c) -> int { if (c >= '0' && c <= '9') return c - '0'; if (c >= 'a' && c <= 'f') return c - 'a' + 10; return -1; };
  for (size_t i = 0; i < 32; ++i) { const int a = digit(value[i * 2]), b = digit(value[i * 2 + 1]); if (a < 0 || b < 0) return false; result[i] = static_cast<uint8_t>((a << 4) | b); }
  return true;
}
std::string base64Encode(const std::string& value) {
  std::string result; result.reserve((value.size() + 2) / 3 * 4);
  for (size_t i = 0; i < value.size(); i += 3) {
    const uint32_t a = static_cast<uint8_t>(value[i]), b = i + 1 < value.size() ? static_cast<uint8_t>(value[i + 1]) : 0;
    const uint32_t c = i + 2 < value.size() ? static_cast<uint8_t>(value[i + 2]) : 0, bits = (a << 16) | (b << 8) | c;
    result.push_back(kAlphabet[(bits >> 18) & 63]); result.push_back(kAlphabet[(bits >> 12) & 63]);
    result.push_back(i + 1 < value.size() ? kAlphabet[(bits >> 6) & 63] : '='); result.push_back(i + 2 < value.size() ? kAlphabet[bits & 63] : '=');
  }
  return result;
}
bool base64Decode(const std::string& value, size_t maximum, std::string& result) {
  result.clear();
  if (value.empty() || value.size() % 4 || value.size() > (maximum + 2) / 3 * 4) return false;
  for (size_t i = 0; i < value.size(); i += 4) {
    uint32_t bits = 0; size_t padding = 0;
    for (size_t j = 0; j < 4; ++j) {
      const char c = value[i + j];
      if (c == '=') { if (j < 2 || i + 4 != value.size()) return false; ++padding; bits <<= 6; }
      else { if (padding || c == '\0') return false; const char* found = std::strchr(kAlphabet, c); if (!found) return false; bits = (bits << 6) | static_cast<uint32_t>(found - kAlphabet); }
    }
    if (padding > 2) return false;
    result.push_back(static_cast<char>((bits >> 16) & 255));
    if (padding < 2) result.push_back(static_cast<char>((bits >> 8) & 255));
    if (!padding) result.push_back(static_cast<char>(bits & 255));
    if (result.size() > maximum) return false;
  }
  return base64Encode(result) == value;
}
bool utcTimestamp(const std::string& value) {
  if (value.size() != 20 || value[4] != '-' || value[7] != '-' || value[10] != 'T' || value[13] != ':' || value[16] != ':' || value[19] != 'Z') return false;
  for (size_t i = 0; i < value.size(); ++i) if (i != 4 && i != 7 && i != 10 && i != 13 && i != 16 && i != 19 && (value[i] < '0' || value[i] > '9')) return false;
  auto number = [&](size_t offset, size_t count) { unsigned result = 0; for (size_t i = 0; i < count; ++i) result = result * 10 + static_cast<unsigned>(value[offset + i] - '0'); return result; };
  const unsigned year = number(0, 4), month = number(5, 2), day = number(8, 2);
  if (year < 2024 || year > 2099 || month < 1 || month > 12 || number(11, 2) > 23 || number(14, 2) > 59 || number(17, 2) > 59) return false;
  const unsigned days[] = {31, static_cast<unsigned>(year % 4 == 0 ? 29 : 28), 31,30,31,30,31,31,30,31,30,31};
  return day > 0 && day <= days[month - 1];
}
bool Journal::mac(const std::string& domain, const std::string& value, Digest& out) {
  Digest key; return hexDecode(identity_.secret, key) && crypto_.hmac(key, domain + value, out);
}
Result Journal::persist(const Identity& identity) {
  JsonDocument state; state["version"] = 1; state["deviceId"] = identity.deviceId; state["epoch"] = identity.epoch;
  state["secret"] = identity.secret; state["source"] = identity.source; state["reservedUntil"] = identity.reservedUntil;
  const std::string raw = serialize(state); Digest hash;
  if (state.overflowed()) return fail(Error::Storage);
  if (!crypto_.sha256("honey-chain-state-v1\n" + raw, hash)) return fail(Error::Crypto);
  JsonDocument wrapper; wrapper["payload"] = base64Encode(raw); wrapper["sha256"] = hexEncode(hash);
  if (wrapper.overflowed()) return fail(Error::Storage);
  if (!store_.writeState(serialize(wrapper))) return fail(Error::Storage);
  return {};
}
Result Journal::ownerValue(std::string& value) {
  Digest hash;
  if (!mac("honey-chain-journal-owner-v1\n", identity_.deviceId + "\n" + identity_.epoch + "\n" + identity_.source, hash)) return fail(Error::Crypto);
  value = hexEncode(hash); return {};
}
Result Journal::begin() {
  configured_ = false; sequences_.clear(); next_ = blockEnd_ = 0;
  std::string encoded; const Read stateRead = store_.readState(encoded);
  if (stateRead == Read::Missing) return fail(Error::Unprovisioned);
  if (stateRead == Read::Failed || encoded.size() > 2048) return fail(Error::CorruptState);
  JsonDocument wrapper, state; std::string raw; Digest expected, actual;
  if (!parseObject(wrapper, encoded, 3)
      || !onlyKeys(wrapper.as<JsonObjectConst>(), {"payload", "sha256"})
      || !base64Decode(jsonString(wrapper["payload"]), 1024, raw)
      || !hexDecode(jsonString(wrapper["sha256"]), expected)
      || !crypto_.sha256("honey-chain-state-v1\n" + raw, actual) || !equalDigest(expected, actual)
      || !parseObject(state, raw, 3)
      || !onlyKeys(state.as<JsonObjectConst>(), {"version", "deviceId", "epoch", "secret", "source", "reservedUntil"})
      || !state["version"].is<unsigned>() || state["version"].as<unsigned>() != 1 || !state["reservedUntil"].is<uint32_t>()) return fail(Error::CorruptState);
  identity_ = {jsonString(state["deviceId"]), jsonString(state["epoch"]), jsonString(state["secret"]), jsonString(state["source"]), state["reservedUntil"].as<uint32_t>()};
  if (!validIdentity(identity_)) return fail(Error::CorruptState);
  configured_ = true; next_ = blockEnd_ = identity_.reservedUntil;
  if (!store_.list(sequences_) || sequences_.size() > kMaximumPackets) return fail(Error::CorruptJournal);
  std::sort(sequences_.begin(), sequences_.end());
  if (std::adjacent_find(sequences_.begin(), sequences_.end()) != sequences_.end()) return fail(Error::CorruptJournal);
  std::string owner, expectedOwner; Result result = ownerValue(expectedOwner); if (!result) return result;
  const Read ownerRead = store_.readOwner(owner);
  if (ownerRead == Read::Failed) return fail(Error::CorruptJournal);
  if (ownerRead != Read::Okay || owner != expectedOwner) {
    if (identity_.reservedUntil != 0 || !sequences_.empty()) return fail(Error::WrongIdentity);
    if (!store_.writeOwner(expectedOwner)) return fail(Error::Storage);
  }
  for (uint32_t sequence : sequences_) {
    std::string envelope;
    if (sequence >= identity_.reservedUntil || store_.readPacket(sequence, envelope) != Read::Okay || !validateEnvelope(envelope, sequence)) return fail(Error::CorruptJournal);
    store_.cooperate();
  }
  fault_ = Error::None; return {};
}
Result Journal::provision(JsonObjectConst value) {
  if (!onlyKeys(value, {"version", "deviceId", "epoch", "secret", "source"}) || !value["version"].is<unsigned>() || value["version"].as<unsigned>() != 1) return {Error::InvalidInput};
  Identity replacement{jsonString(value["deviceId"]), jsonString(value["epoch"]), jsonString(value["secret"]), jsonString(value["source"]), 0};
  if (!validIdentity(replacement)) return {Error::InvalidInput};
  if (configured_) {
    if (replacement.deviceId != identity_.deviceId) return {Error::WrongIdentity};
    if (replacement.epoch == identity_.epoch && replacement.secret == identity_.secret && replacement.source == identity_.source) return {fault_};
    if (fault_ != Error::None) return {fault_};
    if (!sequences_.empty()) return {Error::PendingRotation};
    if (replacement.epoch == identity_.epoch || replacement.secret == identity_.secret) return {Error::WrongIdentity};
  } else {
    std::string prior; std::vector<uint32_t> packets;
    if (fault_ != Error::Unprovisioned || store_.readState(prior) != Read::Missing || !store_.list(packets)) return {Error::CorruptState};
    if (!packets.empty() || store_.readOwner(prior) != Read::Missing) return {Error::PendingRotation};
  }
  Result saved = persist(replacement); if (!saved) return saved;
  return begin();
}
Result Journal::validateEnvelope(const std::string& envelope, uint32_t sequence, std::string* payload) {
  if (envelope.size() > kMaximumWireBytes) return {Error::CorruptJournal};
  JsonDocument outer, packet; std::string raw; Digest signature, actual;
  if (!parseObject(outer, envelope, 3) || !onlyKeys(outer.as<JsonObjectConst>(), {"payload", "signature"})
      || !base64Decode(jsonString(outer["payload"]), 4096, raw) || !hexDecode(jsonString(outer["signature"]), signature)
      || !mac(kTelemetryDomain, raw, actual) || !equalDigest(signature, actual)
      || !parseObject(packet, raw, 4)
      || !onlyKeys(packet.as<JsonObjectConst>(), {"version", "deviceId", "epoch", "sequence", "observedAt", "metrics"})
      || !packet["version"].is<unsigned>() || packet["version"].as<unsigned>() != 1 || !packet["sequence"].is<uint32_t>()
      || packet["sequence"].as<uint32_t>() != sequence || sequence >= kSequenceEnd
      || jsonString(packet["deviceId"]) != identity_.deviceId || jsonString(packet["epoch"]) != identity_.epoch
      || !utcTimestamp(jsonString(packet["observedAt"])) || !metricsValid(packet["metrics"].as<JsonObjectConst>())) return {Error::CorruptJournal};
  if (payload) *payload = raw;
  return {};
}
Result Journal::capture(JsonObjectConst metrics, const std::string& observedAt) {
  if (!ready()) return {fault_};
  if (!metricsValid(metrics) || !utcTimestamp(observedAt)) return {Error::InvalidInput};
  if (sequences_.size() >= kMaximumPackets || !store_.hasSpace(8192)) return {Error::Full};
  if (next_ >= kSequenceEnd) return {Error::Exhausted};
  if (next_ == blockEnd_) {
    Identity reserved = identity_; reserved.reservedUntil = std::min<uint32_t>(kSequenceEnd, next_ + 64U);
    Result result = persist(reserved); if (!result) return result;
    identity_ = reserved; blockEnd_ = reserved.reservedUntil;
  }
  const uint32_t sequence = next_++;
  JsonDocument packet; packet["version"] = 1; packet["deviceId"] = identity_.deviceId; packet["epoch"] = identity_.epoch;
  packet["sequence"] = sequence; packet["observedAt"] = observedAt; packet["metrics"].set(metrics);
  const std::string raw = serialize(packet); Digest signature;
  if (packet.overflowed()) return fail(Error::Storage);
  if (raw.size() > 4096 || !mac(kTelemetryDomain, raw, signature)) return fail(Error::Crypto);
  JsonDocument envelope; envelope["payload"] = base64Encode(raw); envelope["signature"] = hexEncode(signature);
  if (envelope.overflowed()) return fail(Error::Storage);
  if (!store_.putPacket(sequence, serialize(envelope))) return fail(Error::Storage);
  sequences_.push_back(sequence); return {};
}
Result Journal::next(Cursor& cursor, std::string& wire) {
  if (!ready()) return {fault_};
  auto selected = cursor.started ? std::upper_bound(sequences_.begin(), sequences_.end(), cursor.after) : sequences_.begin();
  if (selected == sequences_.end()) { wire = "{\"event\":\"idle\"}"; return {}; }
  std::string envelope;
  if (store_.readPacket(*selected, envelope) != Read::Okay || !validateEnvelope(envelope, *selected)) return fail(Error::CorruptJournal);
  cursor.started = true; cursor.after = *selected; wire = envelope; return {};
}
Result Journal::acknowledge(const std::string& payload, const std::string& signature) {
  if (!ready()) return {fault_};
  std::string raw; Digest supplied, actual; JsonDocument receipt;
  if (!base64Decode(payload, 1024, raw) || !hexDecode(signature, supplied) || !mac(kStoredDomain, raw, actual) || !equalDigest(supplied, actual)
      || !parseObject(receipt, raw, 3)
      || !onlyKeys(receipt.as<JsonObjectConst>(), {"version", "kind", "deviceId", "epoch", "sequence", "packetHash", "readingId"})
      || !receipt["version"].is<unsigned>() || receipt["version"].as<unsigned>() != 1 || jsonString(receipt["kind"]) != "stored"
      || jsonString(receipt["deviceId"]) != identity_.deviceId || jsonString(receipt["epoch"]) != identity_.epoch
      || !receipt["sequence"].is<uint32_t>() || receipt["sequence"].as<uint32_t>() >= kSequenceEnd
      || jsonString(receipt["readingId"]).empty() || jsonString(receipt["readingId"]).size() > 128 || !ascii(jsonString(receipt["readingId"]))
      || !hexDecode(jsonString(receipt["packetHash"]), supplied)) return {Error::InvalidReceipt};
  const uint32_t sequence = receipt["sequence"].as<uint32_t>();
  if (sequence >= identity_.reservedUntil) return fail(Error::CorruptState);
  const auto present = std::lower_bound(sequences_.begin(), sequences_.end(), sequence);
  if (present == sequences_.end() || *present != sequence) return {}; // Repeated valid acknowledgement, already removed.
  std::string envelope, packet;
  if (store_.readPacket(sequence, envelope) != Read::Okay || !validateEnvelope(envelope, sequence, &packet)) return fail(Error::CorruptJournal);
  if (!crypto_.sha256(packet, actual)) return fail(Error::Crypto);
  if (!equalDigest(supplied, actual)) return {Error::InvalidReceipt};
  if (!store_.erasePacket(sequence)) return fail(Error::Storage);
  sequences_.erase(present); return {};
}
Result Journal::rebindAfterExplicitErase() {
  if (!configured_) return {fault_};
  std::vector<uint32_t> packets;
  if (!store_.list(packets) || !packets.empty()) return {Error::PendingRotation};
  std::string owner; Result result = ownerValue(owner); if (!result) return result;
  if (!store_.writeOwner(owner)) return fail(Error::Storage);
  return begin();
}
Result Journal::pairingCode(uint32_t& pin) {
  if (!configured_) return {fault_};
  Digest hash;
  if (!mac("honey-chain-ble-pin-v1\n", identity_.deviceId + "\n" + identity_.epoch, hash)) return {Error::Crypto};
  const uint32_t number = (uint32_t(hash[0]) << 24) | (uint32_t(hash[1]) << 16) | (uint32_t(hash[2]) << 8) | hash[3];
  pin = 100000 + number % 900000; return {};
}
}
