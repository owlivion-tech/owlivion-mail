//! Crypto module for password encryption/decryption
//!
//! Uses AES-256-GCM with HKDF key derivation for secure password storage.
//! Security improvements:
//! - HKDF for proper key derivation (instead of simple SHA256)
//! - Installation-specific salt stored in file
//! - No hardcoded fallback keys
//! - Zeroize sensitive data

use base64::Engine;
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::hkdf;
use ring::rand::{SecureRandom, SystemRandom};
use std::fs;
use std::path::PathBuf;
use zeroize::Zeroize;

const NONCE_LEN: usize = 12;
const SALT_LEN: usize = 32;

/// Wrapper for sensitive data that zeroizes on drop
#[allow(dead_code)]
struct SecureString(String);

impl Drop for SecureString {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[allow(dead_code)]
impl std::ops::Deref for SecureString {
    type Target = String;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Get the salt file path in app data directory
fn get_salt_file_path() -> Result<PathBuf, String> {
    let app_dir = directories::ProjectDirs::from("com", "owlivion", "owlivion-mail")
        .ok_or_else(|| "Failed to get app directories".to_string())?;
    let data_dir = app_dir.data_dir();
    fs::create_dir_all(data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;
    Ok(data_dir.join(".encryption_salt"))
}

/// Get or create installation-specific salt
fn get_or_create_salt() -> Result<[u8; SALT_LEN], String> {
    let salt_path = get_salt_file_path()?;

    // Try to read existing salt
    if salt_path.exists() {
        let salt_data = fs::read(&salt_path)
            .map_err(|e| format!("Failed to read salt file: {}", e))?;

        if salt_data.len() == SALT_LEN {
            let mut salt = [0u8; SALT_LEN];
            salt.copy_from_slice(&salt_data);
            return Ok(salt);
        }
    }

    // Generate new salt
    let rng = SystemRandom::new();
    let mut salt = [0u8; SALT_LEN];
    rng.fill(&mut salt)
        .map_err(|e| format!("Failed to generate salt: {:?}", e))?;

    // Save salt to file with restricted permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&salt_path)
            .map_err(|e| format!("Failed to create salt file: {}", e))?;
        use std::io::Write;
        file.write_all(&salt)
            .map_err(|e| format!("Failed to write salt: {}", e))?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&salt_path, &salt)
            .map_err(|e| format!("Failed to write salt: {}", e))?;
    }

    Ok(salt)
}

/// Get a unique machine identifier
/// SECURITY: Combines multiple entropy sources for better key uniqueness
fn get_machine_id() -> Result<String, String> {
    let mut id_parts: Vec<String> = Vec::new();

    // 1. Try to read machine-id (Linux)
    #[cfg(target_os = "linux")]
    if let Ok(id) = fs::read_to_string("/etc/machine-id") {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            id_parts.push(trimmed);
        }
    }

    // 2. Try to get hostname
    if let Ok(hostname) = hostname::get() {
        if let Some(h) = hostname.to_str() {
            if !h.is_empty() {
                id_parts.push(h.to_string());
            }
        }
    }

    // 3. Get username for per-user key isolation
    #[cfg(unix)]
    if let Ok(user) = std::env::var("USER") {
        if !user.is_empty() {
            id_parts.push(user);
        }
    }
    #[cfg(windows)]
    if let Ok(user) = std::env::var("USERNAME") {
        if !user.is_empty() {
            id_parts.push(user);
        }
    }

    // 4. Get home directory path as additional entropy
    if let Some(home) = directories::BaseDirs::new() {
        id_parts.push(home.home_dir().to_string_lossy().to_string());
    }

    // SECURITY: Require at least 2 entropy sources
    if id_parts.len() < 2 {
        return Err("Insufficient entropy sources for key derivation. Cannot safely generate encryption key.".to_string());
    }

    // Combine all parts with separator
    Ok(id_parts.join("|"))
}

/// Derive encryption key using HKDF
/// SECURITY: Uses machine ID + user + installation-specific salt for key material
fn get_encryption_key() -> Result<[u8; 32], String> {
    let salt = get_or_create_salt()?;
    let machine_id = get_machine_id()?;

    // Create HKDF salt from installation salt
    let hkdf_salt = hkdf::Salt::new(hkdf::HKDF_SHA256, &salt);

    // Input key material: machine ID (now includes user info)
    let ikm = machine_id.as_bytes();

    // Extract
    let prk = hkdf_salt.extract(ikm);

    // Expand with context info
    let info: &[&[u8]] = &[b"owlivion-mail-password-encryption-v3"];
    let okm = prk.expand(info, MyKeyType(32))
        .map_err(|_| "HKDF expansion failed".to_string())?;

    let mut key = [0u8; 32];
    okm.fill(&mut key)
        .map_err(|_| "Failed to fill key bytes".to_string())?;

    Ok(key)
}

/// Custom key type for HKDF output
struct MyKeyType(usize);

impl hkdf::KeyType for MyKeyType {
    fn len(&self) -> usize {
        self.0
    }
}

/// Encrypt a password
/// Returns base64-encoded ciphertext with prepended nonce
pub fn encrypt_password(password: &str) -> Result<String, String> {
    let mut key_bytes = get_encryption_key()?;

    let result = (|| {
        let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|e| format!("Key error: {:?}", e))?;
        let key = LessSafeKey::new(unbound_key);

        // Generate random nonce
        let rng = SystemRandom::new();
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rng.fill(&mut nonce_bytes)
            .map_err(|e| format!("RNG error: {:?}", e))?;

        // Prepare plaintext with space for tag
        let mut in_out = password.as_bytes().to_vec();

        // Encrypt in place
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);
        key.seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|e| format!("Encryption error: {:?}", e))?;

        // Prepend nonce to ciphertext
        let mut result = Vec::with_capacity(NONCE_LEN + in_out.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&in_out);

        // Base64 encode
        Ok(base64::engine::general_purpose::STANDARD.encode(&result))
    })();

    // Zeroize key after use
    key_bytes.zeroize();

    result
}

/// Decrypt a password
/// Takes base64-encoded ciphertext with prepended nonce
pub fn decrypt_password(encrypted: &str) -> Result<String, String> {
    // Base64 decode
    let data = base64::engine::general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    if data.len() < NONCE_LEN + 16 {
        // Minimum: nonce + tag
        return Err("Encrypted data too short".to_string());
    }

    let mut key_bytes = get_encryption_key()?;

    let result = (|| {
        let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|e| format!("Key error: {:?}", e))?;
        let key = LessSafeKey::new(unbound_key);

        // Extract nonce and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
        let nonce = Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|_| "Invalid nonce".to_string())?;

        // Decrypt in place
        let mut in_out = ciphertext.to_vec();
        let plaintext = key
            .open_in_place(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| "Decryption failed - invalid key or corrupted data".to_string())?;

        String::from_utf8(plaintext.to_vec())
            .map_err(|e| format!("UTF-8 decode error: {}", e))
    })();

    // Zeroize key after use
    key_bytes.zeroize();

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "my_secret_password123!";
        let encrypted = encrypt_password(password).expect("Encryption failed");

        // Encrypted should be base64 and different from original
        assert_ne!(encrypted, password);
        assert!(encrypted.len() > password.len());

        // Decrypt should return original
        let decrypted = decrypt_password(&encrypted).expect("Decryption failed");
        assert_eq!(decrypted, password);
    }

    #[test]
    fn test_different_encryptions() {
        let password = "test_password";
        let encrypted1 = encrypt_password(password).expect("Encryption 1 failed");
        let encrypted2 = encrypt_password(password).expect("Encryption 2 failed");

        // Due to random nonce, encryptions should be different
        assert_ne!(encrypted1, encrypted2);

        // Both should decrypt to same value
        let decrypted1 = decrypt_password(&encrypted1).expect("Decryption 1 failed");
        let decrypted2 = decrypt_password(&encrypted2).expect("Decryption 2 failed");
        assert_eq!(decrypted1, password);
        assert_eq!(decrypted2, password);
    }

    #[test]
    fn test_empty_password() {
        let password = "";
        let encrypted = encrypt_password(password).expect("Encryption failed");
        let decrypted = decrypt_password(&encrypted).expect("Decryption failed");
        assert_eq!(decrypted, password);
    }

    #[test]
    fn test_unicode_password() {
        let password = "şifre123!@#$%ğüışöç";
        let encrypted = encrypt_password(password).expect("Encryption failed");
        let decrypted = decrypt_password(&encrypted).expect("Decryption failed");
        assert_eq!(decrypted, password);
    }

    #[test]
    fn test_salt_persistence() {
        // First call creates salt
        let key1 = get_encryption_key().expect("First key generation failed");

        // Second call should use same salt
        let key2 = get_encryption_key().expect("Second key generation failed");

        // Keys should be identical (same salt, same machine)
        assert_eq!(key1, key2);
    }
}
