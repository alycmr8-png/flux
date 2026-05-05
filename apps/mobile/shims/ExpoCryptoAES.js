// Replaces both ExpoCryptoAES native module AND expo-crypto/build/aes/*
// AES is only needed for OAuth/SSO PKCE — we use email/password auth only.

function notAvailable() { throw new Error("AES not available in this build"); }

class EncryptionKey {}
class AESEncryptionKey extends EncryptionKey {}
class SealedData {
  static fromParts() { notAvailable(); }
  static fromCombined() { notAvailable(); }
}
class AESSealedData extends SealedData {}

const stub = {
  EncryptionKey,
  SealedData,
  AESEncryptionKey,
  AESSealedData,
  encryptAsync: async () => notAvailable(),
  decryptAsync: async () => notAvailable(),
  aesEncryptAsync: async () => notAvailable(),
  aesDecryptAsync: async () => notAvailable(),
};

// Support both default import and named imports
module.exports = stub;
module.exports.default = stub;
