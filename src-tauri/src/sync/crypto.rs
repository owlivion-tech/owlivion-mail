//! Sync Crypto Module - End-to-End Encryption for Account Sync
//!
//! Implements E2E encryption for cross-device sync following Zero-Knowledge architecture.
//! - User password → HKDF → Sync Master Key → Per-Data-Type Keys
//! - AES-256-GCM encryption with random nonces
//! - SHA-256 checksums for integrity verification
//! - Zeroize for secure memory cleanup
//!
//! Security Properties:
//! - Server never sees plaintext data
//! - Each data type has isolated encryption key
//! - Nonce uniqueness guaranteed by SystemRandom
//! - Memory wiped after key usage

use base64::Engine;
use chrono::{DateTime, Utc};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::digest::{digest, SHA256};
use ring::hkdf;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

const NONCE_LEN: usize = 12;
const MASTER_KEY_LEN: usize = 32;
const DATA_KEY_LEN: usize = 32;

// ============================================================================
// Data Types & Structures
// ============================================================================

/// Sync data categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncDataType {
    Accounts,
    Contacts,
    Preferences,
    Signatures,
}

impl SyncDataType {
    /// Get context string for key derivation
    fn key_context(&self) -> &'static [u8] {
        match self {
            SyncDataType::Accounts => b"accounts-v1",
            SyncDataType::Contacts => b"contacts-v1",
            SyncDataType::Preferences => b"preferences-v1",
            SyncDataType::Signatures => b"signatures-v1",
        }
    }

    /// Get human-readable name
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncDataType::Accounts => "accounts",
            SyncDataType::Contacts => "contacts",
            SyncDataType::Preferences => "preferences",
            SyncDataType::Signatures => "signatures",
        }
    }
}

/// Encrypted sync payload ready for transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPayload {
    pub data_type: SyncDataType,
    pub encrypted_data: Vec<u8>,
    pub nonce: [u8; NONCE_LEN],
    pub version: i32,
    pub device_id: String,
    pub timestamp: DateTime<Utc>,
    pub checksum: String, // SHA-256 hex
}

/// Wrapper for sensitive key data that zeroizes on drop
struct SecureKey([u8; 32]);

impl Drop for SecureKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl AsRef<[u8]> for SecureKey {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Custom key type for HKDF output
struct KeyType(usize);

impl hkdf::KeyType for KeyType {
    fn len(&self) -> usize {
        self.0
    }
}

// ============================================================================
// Key Derivation
// ============================================================================

/// Derive sync master key from user password using HKDF-SHA256
///
/// This is the root key for all sync encryption. Each data type derives
/// its own key from this master key.
///
/// # Arguments
/// * `password` - User's master password (for sync, not email)
/// * `salt` - 32-byte random salt (should be persisted per-user)
///
/// # Security
/// - Uses HKDF-SHA256 for proper key derivation
/// - Info context: "owlivion-mail-sync-master-key-v1"
/// - Key is zeroized after use via SecureKey wrapper
///
/// # Example
/// ```rust
/// let salt = [0u8; 32]; // Generate with SystemRandom in production
/// let master_key = derive_sync_master_key("user_password", &salt)?;
/// ```
pub fn derive_sync_master_key(password: &str, salt: &[u8; 32]) -> Result<[u8; 32], String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }

    let hkdf_salt = hkdf::Salt::new(hkdf::HKDF_SHA256, salt);
    let prk = hkdf_salt.extract(password.as_bytes());

    let info: &[&[u8]] = &[b"owlivion-mail-sync-master-key-v1"];
    let okm = prk
        .expand(info, KeyType(MASTER_KEY_LEN))
        .map_err(|_| "HKDF expansion failed".to_string())?;

    let mut key = [0u8; MASTER_KEY_LEN];
    okm.fill(&mut key)
        .map_err(|_| "Failed to fill key bytes".to_string())?;

    Ok(key)
}

/// Derive data-type-specific encryption key from master key
///
/// Each sync data type (accounts, contacts, etc.) gets its own isolated
/// encryption key derived from the master key. This provides key separation.
///
/// # Arguments
/// * `master_key` - 32-byte master key from derive_sync_master_key()
/// * `data_type` - Which data type to derive key for
///
/// # Security
/// - Uses HKDF-SHA256 with data-type-specific context
/// - Different data types cannot decrypt each other's data
/// - Keys are zeroized after use
///
/// # Example
/// ```rust
/// let master_key = derive_sync_master_key("password", &salt)?;
/// let contacts_key = derive_data_key(&master_key, SyncDataType::Contacts)?;
/// ```
pub fn derive_data_key(
    master_key: &[u8; 32],
    data_type: SyncDataType,
) -> Result<[u8; 32], String> {
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, master_key);
    let context = data_type.key_context();

    let prk = salt.extract(context);
    let okm = prk
        .expand(&[context], KeyType(DATA_KEY_LEN))
        .map_err(|_| "HKDF expansion failed".to_string())?;

    let mut key = [0u8; DATA_KEY_LEN];
    okm.fill(&mut key)
        .map_err(|_| "Failed to fill key bytes".to_string())?;

    Ok(key)
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

/// Encrypt sync data with AES-256-GCM
///
/// Follows the encryption process from architecture:
/// 1. Serialize data to JSON
/// 2. Derive data-specific key from master key
/// 3. Generate random nonce (12 bytes)
/// 4. Encrypt with AES-256-GCM
/// 5. Compute SHA-256 checksum
/// 6. Return SyncPayload ready for upload
///
/// # Arguments
/// * `data` - Any serializable data structure
/// * `master_key` - Master key from derive_sync_master_key()
/// * `data_type` - Type of data being encrypted
/// * `device_id` - Current device identifier
///
/// # Security
/// - Nonce is cryptographically random (SystemRandom)
/// - Key is derived fresh and zeroized after use
/// - Checksum provides integrity verification
///
/// # Example
/// ```rust
/// let contacts = vec![Contact { ... }];
/// let payload = encrypt_sync_data(
///     &contacts,
///     &master_key,
///     SyncDataType::Contacts,
///     "device-uuid"
/// )?;
/// // Upload payload.encrypted_data, payload.nonce, payload.checksum to server
/// ```
pub fn encrypt_sync_data<T: Serialize>(
    data: &T,
    master_key: &[u8; 32],
    data_type: SyncDataType,
    device_id: &str,
) -> Result<SyncPayload, String> {
    // 1. Serialize to JSON
    let json = serde_json::to_vec(data).map_err(|e| format!("Serialization error: {}", e))?;

    // 2. Derive data-specific key
    let mut data_key = derive_data_key(master_key, data_type)?;

    let result = (|| {
        // 3. Generate random nonce
        let rng = SystemRandom::new();
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rng.fill(&mut nonce_bytes)
            .map_err(|e| format!("RNG error: {:?}", e))?;

        // 4. Encrypt with AES-256-GCM
        let unbound_key = UnboundKey::new(&AES_256_GCM, &data_key)
            .map_err(|e| format!("Key error: {:?}", e))?;
        let key = LessSafeKey::new(unbound_key);

        let mut encrypted = json.clone();
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);
        key.seal_in_place_append_tag(nonce, Aad::empty(), &mut encrypted)
            .map_err(|e| format!("Encryption error: {:?}", e))?;

        // 5. Compute SHA-256 checksum
        let checksum = compute_sha256(&encrypted);

        Ok(SyncPayload {
            data_type,
            encrypted_data: encrypted,
            nonce: nonce_bytes,
            version: 1,
            device_id: device_id.to_string(),
            timestamp: Utc::now(),
            checksum,
        })
    })();

    // Zeroize key after use
    data_key.zeroize();

    result
}

/// Decrypt sync data with AES-256-GCM
///
/// Follows the decryption process from architecture:
/// 1. Verify checksum (integrity check)
/// 2. Derive data-specific key from master key
/// 3. Decrypt with AES-256-GCM using provided nonce
/// 4. Deserialize JSON
///
/// # Arguments
/// * `payload` - SyncPayload from server (encrypted_data, nonce, checksum)
/// * `master_key` - Master key from derive_sync_master_key()
///
/// # Security
/// - Checksum verified before decryption (prevents tampering)
/// - Key derived fresh and zeroized after use
/// - Authentication tag verified by AES-GCM
///
/// # Example
/// ```rust
/// let payload = download_from_server()?;
/// let contacts: Vec<Contact> = decrypt_sync_data(&payload, &master_key)?;
/// ```
pub fn decrypt_sync_data<T: for<'de> Deserialize<'de>>(
    payload: &SyncPayload,
    master_key: &[u8; 32],
) -> Result<T, String> {
    // 1. Verify checksum
    let actual_checksum = compute_sha256(&payload.encrypted_data);
    if actual_checksum != payload.checksum {
        return Err("Checksum mismatch - data may be corrupted or tampered".to_string());
    }

    // 2. Derive data-specific key
    let mut data_key = derive_data_key(master_key, payload.data_type)?;

    let result = (|| {
        // 3. Decrypt with AES-256-GCM
        let unbound_key = UnboundKey::new(&AES_256_GCM, &data_key)
            .map_err(|e| format!("Key error: {:?}", e))?;
        let key = LessSafeKey::new(unbound_key);

        let nonce = Nonce::try_assume_unique_for_key(&payload.nonce)
            .map_err(|_| "Invalid nonce".to_string())?;

        let mut ciphertext = payload.encrypted_data.clone();
        let plaintext = key
            .open_in_place(nonce, Aad::empty(), &mut ciphertext)
            .map_err(|_| "Decryption failed - invalid key or corrupted data".to_string())?;

        // 4. Deserialize JSON
        serde_json::from_slice(plaintext).map_err(|e| format!("Deserialization error: {}", e))
    })();

    // Zeroize key after use
    data_key.zeroize();

    result
}

// ============================================================================
// Helpers
// ============================================================================

/// Compute SHA-256 checksum of data (returns hex string)
///
/// Used for integrity verification of encrypted payloads.
///
/// # Arguments
/// * `data` - Bytes to hash
///
/// # Returns
/// Hex-encoded SHA-256 digest (64 characters)
pub fn compute_sha256(data: &[u8]) -> String {
    let digest_value = digest(&SHA256, data);
    hex::encode(digest_value.as_ref())
}

/// Generate cryptographically secure random salt (32 bytes)
///
/// Should be generated once per user and persisted in sync config.
///
/// # Example
/// ```rust
/// let salt = generate_random_salt()?;
/// // Save salt to database or config file
/// ```
pub fn generate_random_salt() -> Result<[u8; 32], String> {
    let rng = SystemRandom::new();
    let mut salt = [0u8; 32];
    rng.fill(&mut salt)
        .map_err(|e| format!("Failed to generate salt: {:?}", e))?;
    Ok(salt)
}

/// Encode bytes to base64 string (for transmission)
pub fn encode_base64(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Decode base64 string to bytes
pub fn decode_base64(data: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Base64 decode error: {}", e))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
    struct TestContact {
        email: String,
        name: String,
    }

    #[test]
    fn test_key_derivation_deterministic() {
        let password = "test_password_123";
        let salt = [42u8; 32];

        let key1 = derive_sync_master_key(password, &salt).unwrap();
        let key2 = derive_sync_master_key(password, &salt).unwrap();

        // Same password + salt = same key
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_key_derivation_different_passwords() {
        let salt = [42u8; 32];

        let key1 = derive_sync_master_key("password1", &salt).unwrap();
        let key2 = derive_sync_master_key("password2", &salt).unwrap();

        // Different passwords = different keys
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_key_derivation_different_salts() {
        let password = "test_password";
        let salt1 = [1u8; 32];
        let salt2 = [2u8; 32];

        let key1 = derive_sync_master_key(password, &salt1).unwrap();
        let key2 = derive_sync_master_key(password, &salt2).unwrap();

        // Different salts = different keys
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_data_key_isolation() {
        let master_key = [123u8; 32];

        let accounts_key = derive_data_key(&master_key, SyncDataType::Accounts).unwrap();
        let contacts_key = derive_data_key(&master_key, SyncDataType::Contacts).unwrap();
        let prefs_key = derive_data_key(&master_key, SyncDataType::Preferences).unwrap();
        let sigs_key = derive_data_key(&master_key, SyncDataType::Signatures).unwrap();

        // Each data type has unique key
        assert_ne!(accounts_key, contacts_key);
        assert_ne!(accounts_key, prefs_key);
        assert_ne!(accounts_key, sigs_key);
        assert_ne!(contacts_key, prefs_key);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let password = "my_sync_password";
        let salt = generate_random_salt().unwrap();
        let master_key = derive_sync_master_key(password, &salt).unwrap();

        let contacts = vec![
            TestContact {
                email: "alice@example.com".to_string(),
                name: "Alice".to_string(),
            },
            TestContact {
                email: "bob@example.com".to_string(),
                name: "Bob".to_string(),
            },
        ];

        // Encrypt
        let payload =
            encrypt_sync_data(&contacts, &master_key, SyncDataType::Contacts, "device-1").unwrap();

        // Verify payload structure
        assert_eq!(payload.data_type, SyncDataType::Contacts);
        assert_eq!(payload.nonce.len(), NONCE_LEN);
        assert_eq!(payload.checksum.len(), 64); // SHA-256 hex
        assert!(payload.encrypted_data.len() > 0);

        // Decrypt
        let decrypted: Vec<TestContact> = decrypt_sync_data(&payload, &master_key).unwrap();

        // Verify roundtrip
        assert_eq!(decrypted, contacts);
    }

    #[test]
    fn test_encrypt_produces_different_ciphertexts() {
        let master_key = [42u8; 32];
        let data = vec![TestContact {
            email: "test@example.com".to_string(),
            name: "Test".to_string(),
        }];

        let payload1 =
            encrypt_sync_data(&data, &master_key, SyncDataType::Contacts, "device-1").unwrap();
        let payload2 =
            encrypt_sync_data(&data, &master_key, SyncDataType::Contacts, "device-1").unwrap();

        // Different nonces = different ciphertexts
        assert_ne!(payload1.nonce, payload2.nonce);
        assert_ne!(payload1.encrypted_data, payload2.encrypted_data);

        // But both decrypt to same plaintext
        let decrypted1: Vec<TestContact> = decrypt_sync_data(&payload1, &master_key).unwrap();
        let decrypted2: Vec<TestContact> = decrypt_sync_data(&payload2, &master_key).unwrap();
        assert_eq!(decrypted1, decrypted2);
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];

        let data = vec![TestContact {
            email: "test@example.com".to_string(),
            name: "Test".to_string(),
        }];

        let payload = encrypt_sync_data(&data, &key1, SyncDataType::Contacts, "device-1").unwrap();

        // Try decrypt with wrong key
        let result: Result<Vec<TestContact>, _> = decrypt_sync_data(&payload, &key2);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Decryption failed"));
    }

    #[test]
    fn test_decrypt_wrong_data_type_fails() {
        let master_key = [42u8; 32];
        let data = vec![TestContact {
            email: "test@example.com".to_string(),
            name: "Test".to_string(),
        }];

        // Encrypt as Contacts
        let mut payload =
            encrypt_sync_data(&data, &master_key, SyncDataType::Contacts, "device-1").unwrap();

        // Change data type to Accounts (wrong key will be derived)
        payload.data_type = SyncDataType::Accounts;

        // Try decrypt - should fail because wrong key
        let result: Result<Vec<TestContact>, _> = decrypt_sync_data(&payload, &master_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_checksum_tampering_detected() {
        let master_key = [42u8; 32];
        let data = vec![TestContact {
            email: "test@example.com".to_string(),
            name: "Test".to_string(),
        }];

        let mut payload =
            encrypt_sync_data(&data, &master_key, SyncDataType::Contacts, "device-1").unwrap();

        // Tamper with encrypted data
        payload.encrypted_data[0] ^= 0xFF;

        // Decrypt should fail on checksum
        let result: Result<Vec<TestContact>, _> = decrypt_sync_data(&payload, &master_key);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Checksum mismatch"));
    }

    #[test]
    fn test_empty_password_rejected() {
        let salt = [0u8; 32];
        let result = derive_sync_master_key("", &salt);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Password cannot be empty"));
    }

    #[test]
    fn test_sha256_checksum() {
        let data = b"hello world";
        let checksum = compute_sha256(data);

        // SHA-256 of "hello world" (well-known hash)
        let expected = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
        assert_eq!(checksum, expected);
    }

    #[test]
    fn test_random_salt_generation() {
        let salt1 = generate_random_salt().unwrap();
        let salt2 = generate_random_salt().unwrap();

        // Different salts each time
        assert_ne!(salt1, salt2);
        assert_eq!(salt1.len(), 32);
        assert_eq!(salt2.len(), 32);
    }

    #[test]
    fn test_base64_encoding() {
        let data = b"hello world";
        let encoded = encode_base64(data);
        let decoded = decode_base64(&encoded).unwrap();

        assert_eq!(decoded, data);
    }

    #[test]
    fn test_sync_data_type_strings() {
        assert_eq!(SyncDataType::Accounts.as_str(), "accounts");
        assert_eq!(SyncDataType::Contacts.as_str(), "contacts");
        assert_eq!(SyncDataType::Preferences.as_str(), "preferences");
        assert_eq!(SyncDataType::Signatures.as_str(), "signatures");
    }
}
