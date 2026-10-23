// Host-only fault model. It never opens serial ports, flashes boards or accepts production credentials from files.
#include "../HoneyChainHive/src/honeychain/core.hpp"
#include <iostream>
#include <map>
#include <memory>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#else
#include <openssl/evp.h>
#include <openssl/hmac.h>
#endif
using namespace honeychain;
class HostCrypto : public Crypto {
 public:
  bool sha256(const std::string& bytes, Digest& out) override { return calculate(nullptr, bytes, out); }
  bool hmac(const Digest& key, const std::string& bytes, Digest& out) override { return calculate(&key, bytes, out); }
 private:
  bool calculate(const Digest* key, const std::string& bytes, Digest& out) {
#ifdef _WIN32
    BCRYPT_ALG_HANDLE provider = nullptr;
    if (BCryptOpenAlgorithmProvider(&provider, BCRYPT_SHA256_ALGORITHM, nullptr, key ? BCRYPT_ALG_HANDLE_HMAC_FLAG : 0) != 0) return false;
    ULONG objectSize = 0, returned = 0;
    NTSTATUS result = BCryptGetProperty(provider, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&objectSize), sizeof(objectSize), &returned, 0);
    std::vector<uint8_t> object(objectSize); BCRYPT_HASH_HANDLE hash = nullptr;
    if (result == 0) result = BCryptCreateHash(provider, &hash, object.data(), objectSize, key ? const_cast<PUCHAR>(key->data()) : nullptr, key ? 32 : 0, 0);
    if (result == 0) result = BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char*>(bytes.data())), static_cast<ULONG>(bytes.size()), 0);
    if (result == 0) result = BCryptFinishHash(hash, out.data(), 32, 0);
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(provider, 0); return result == 0;
#else
    unsigned int size = 0;
    if (key) return HMAC(EVP_sha256(), key->data(), 32, reinterpret_cast<const unsigned char*>(bytes.data()), bytes.size(), out.data(), &size) && size == 32;
    return EVP_Digest(bytes.data(), bytes.size(), out.data(), &size, EVP_sha256(), nullptr) == 1 && size == 32;
#endif
  }
};
class MemoryStore : public Store {
 public:
  std::string state, owner, fault;
  std::map<uint32_t, std::string> packets;
  bool space = true;
  bool interrupt(const char* point) { if (fault != point) return false; fault.clear(); return true; }
  Read readState(std::string& value) override { if (state.empty()) return Read::Missing; value = state; return Read::Okay; }
  bool writeState(const std::string& value) override { if (interrupt("state-before")) return false; state = value; return !interrupt("state-after"); }
  Read readOwner(std::string& value) override { if (owner.empty()) return Read::Missing; value = owner; return Read::Okay; }
  bool writeOwner(const std::string& value) override { if (interrupt("owner-before")) return false; owner = value; return !interrupt("owner-after"); }
  bool list(std::vector<uint32_t>& sequences) override { sequences.clear(); for (const auto& packet : packets) sequences.push_back(packet.first); return true; }
  Read readPacket(uint32_t sequence, std::string& value) override { const auto found = packets.find(sequence); if (found == packets.end()) return Read::Missing; value = found->second; return Read::Okay; }
  bool putPacket(uint32_t sequence, const std::string& value) override { if (interrupt("packet-before") || packets.count(sequence)) return false; packets[sequence] = value; return !interrupt("packet-after"); }
  bool erasePacket(uint32_t sequence) override { if (interrupt("erase-before")) return false; packets.erase(sequence); return !interrupt("erase-after"); }
  bool hasSpace(size_t) override { return space; }
};
int main() {
  HostCrypto crypto; MemoryStore store;
  auto journal = std::make_unique<Journal>(store, crypto); Cursor cursor;
  std::string line;
  while (std::getline(std::cin, line)) {
    JsonDocument request, response; Result result; std::string wire;
    if (line.size() > 16384 || deserializeJson(request, line, DeserializationOption::NestingLimit(7))) { response["ok"] = false; response["error"] = "INVALID_DRIVER_REQUEST"; }
    else {
      const std::string op = jsonString(request["op"]);
      if (op == "boot" || op == "crash") { journal = std::make_unique<Journal>(store, crypto); cursor = {}; result = journal->begin(); }
      else if (op == "provision") result = journal->provision(request["identity"].as<JsonObjectConst>());
      else if (op == "capture") result = journal->capture(request["metrics"].as<JsonObjectConst>(), jsonString(request["observedAt"]));
      else if (op == "next") { if (request["rewind"].as<bool>()) cursor = {}; result = journal->next(cursor, wire); }
      else if (op == "ack") result = journal->acknowledge(jsonString(request["receipt"]["payload"]), jsonString(request["receipt"]["signature"]));
      else if (op == "fault") store.fault = jsonString(request["point"]);
      else if (op == "space") store.space = request["available"].as<bool>();
      else if (op == "tamper-packet") store.packets[request["sequence"].as<uint32_t>()] += "not-json";
      else if (op == "tamper-state") store.state += "not-json";
      else if (op == "drop-owner") store.owner.clear();
      else if (op == "set-reservation") {
        JsonDocument wrapper, state; std::string raw;
        if (deserializeJson(wrapper, store.state) || !base64Decode(jsonString(wrapper["payload"]), 1024, raw) || deserializeJson(state, raw)) result = {Error::InvalidInput};
        else { state["reservedUntil"] = request["until"].as<uint32_t>(); raw.clear(); serializeJson(state, raw); Digest hash; crypto.sha256("honey-chain-state-v1\n" + raw, hash);
          wrapper["payload"] = base64Encode(raw); wrapper["sha256"] = hexEncode(hash); store.state.clear(); serializeJson(wrapper, store.state); }
      } else if (op == "fill") {
        for (size_t i = 0; i < request["count"].as<size_t>(); ++i) { result = journal->capture(request["metrics"].as<JsonObjectConst>(), jsonString(request["observedAt"])); if (!result) break; }
      } else if (op == "status") {}
      else result = {Error::InvalidInput};
      response["ok"] = static_cast<bool>(result); response["error"] = errorName(result.error); response["fault"] = errorName(journal->fault());
      response["ready"] = journal->ready(); response["pending"] = journal->pending(); response["nextSequence"] = journal->nextSequence();
      response["durablePackets"] = store.packets.size();
      if (!wire.empty()) { JsonDocument frame; if (!deserializeJson(frame, wire)) response["frame"].set(frame.as<JsonVariantConst>()); }
    }
    serializeJson(response, std::cout); std::cout << std::endl;
  }
  return 0;
}
