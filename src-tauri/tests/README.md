# Owlivion Mail - Client-Side Rust Tests

Kapsamlı Rust integration ve unit testleri.

## Test Coverage

### Crypto Module Tests (`src/sync/crypto.rs`)
- ✅ Key derivation (HKDF-SHA256)
  - Deterministic key generation
  - Different passwords/salts produce different keys
  - Per-data-type key isolation
- ✅ Encryption/Decryption (AES-256-GCM)
  - Round-trip encrypt/decrypt
  - Nonce uniqueness
  - Wrong key detection
  - Wrong data type detection
- ✅ Integrity verification
  - Checksum validation
  - Tampering detection
- ✅ Edge cases
  - Empty password rejection
  - Base64 encoding/decoding
  - SHA-256 checksums

### Models Module Tests (`src/sync/models.rs`)
- ✅ SyncConfig defaults
- ✅ Platform detection (Linux/macOS/Windows)
- ✅ Data serialization/deserialization
- ✅ Contact merge logic
- ✅ Signature CRUD operations
- ✅ Timestamp updates

### API Client Tests (`src/sync/api.rs`)
- ✅ Client creation
- ✅ Token management (set, get, clear)

### Sync Manager Tests (`src/sync/manager.rs`)
- ✅ Manager creation with default config
- ✅ Config updates
- ✅ Logout clears state

### Integration Tests (`src/sync/tests.rs`)
- ✅ **HTTP API Mocking** (with mockito)
  - Register/login/refresh HTTP requests
  - Upload/download HTTP requests
  - Error responses (401, 404, 429)
  - Rate limiting
- ✅ **SyncManager Integration**
  - Config management
  - State clearing on logout
  - Error scenarios (disabled sync, missing salt)
- ✅ **End-to-End Encryption Flow**
  - Complete encrypt → upload → download → decrypt cycle
  - Multi-data-type isolation
- ✅ **Concurrent Operations**
  - Multiple readers
  - Multiple writers
  - Race condition safety
- ✅ **Memory Safety**
  - Zeroize verification
  - Panic-safe cleanup
- ✅ **Performance Benchmarks**
  - Large dataset encryption (1000 contacts)
  - Key derivation speed
- ✅ **Edge Cases**
  - Empty data
  - Large data (10KB+ fields)
  - Special characters (Unicode, emoji)

## Running Tests

### Prerequisites

#### Install System Dependencies (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
    build-essential \
    libssl-dev \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev
```

#### Install Rust (if not already installed)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Run All Tests
```bash
cd src-tauri

# Run all library tests
cargo test --lib

# Run only sync module tests
cargo test --lib sync

# Run specific test
cargo test --lib test_key_derivation_deterministic

# Run with output
cargo test --lib -- --nocapture

# Run with verbose output
cargo test --lib -- --show-output
```

### Run Tests with Coverage (tarpaulin)
```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Run tests with coverage
cd src-tauri
cargo tarpaulin --lib --out Html --output-dir ../coverage

# Open coverage report
xdg-open ../coverage/index.html
```

### Run Benchmarks
```bash
cd src-tauri

# Run performance tests with timing output
cargo test --lib --release test_encryption_performance -- --nocapture
cargo test --lib --release test_key_derivation_performance -- --nocapture
```

### Integration Tests with Mock Server
```bash
# Tests in src/sync/tests.rs use mockito for HTTP mocking
# They don't require a real server running

cargo test --lib integration_tests
```

## Test Output Example

```
running 45 tests
test sync::crypto::tests::test_key_derivation_deterministic ... ok
test sync::crypto::tests::test_encrypt_decrypt_roundtrip ... ok
test sync::crypto::tests::test_checksum_tampering_detected ... ok
test sync::models::tests::test_sync_config_default ... ok
test sync::tests::integration_tests::test_encrypt_upload_download_decrypt_flow ... ok
test sync::tests::integration_tests::test_concurrent_config_access ... ok
test sync::tests::integration_tests::test_key_zeroization_after_use ... ok

test result: ok. 45 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.34s
```

## Debugging Tests

### Enable Logging
```bash
# Set log level
export RUST_LOG=debug

# Run tests with logging
cargo test --lib sync -- --nocapture
```

### Run Single Test with Backtrace
```bash
export RUST_BACKTRACE=1
cargo test --lib test_encrypt_decrypt_roundtrip -- --exact --nocapture
```

### Test in Release Mode (for performance)
```bash
cargo test --lib --release sync
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Rust Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install system dependencies
        run: |
          sudo apt update
          sudo apt install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
            libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true

      - name: Cache cargo registry
        uses: actions/cache@v3
        with:
          path: ~/.cargo/registry
          key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache cargo index
        uses: actions/cache@v3
        with:
          path: ~/.cargo/git
          key: ${{ runner.os }}-cargo-index-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache target directory
        uses: actions/cache@v3
        with:
          path: src-tauri/target
          key: ${{ runner.os }}-cargo-target-${{ hashFiles('**/Cargo.lock') }}

      - name: Run tests
        run: |
          cd src-tauri
          cargo test --lib

      - name: Run clippy
        run: |
          cd src-tauri
          cargo clippy --lib -- -D warnings

      - name: Check formatting
        run: |
          cd src-tauri
          cargo fmt -- --check
```

## Writing New Tests

### Unit Test Pattern
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_name() {
        // Arrange
        let input = "test data";

        // Act
        let result = function_to_test(input);

        // Assert
        assert_eq!(result, expected_value);
    }
}
```

### Async Test Pattern
```rust
#[tokio::test]
async fn test_async_feature() {
    let manager = SyncManager::new();
    let result = manager.some_async_operation().await;

    assert!(result.is_ok());
}
```

### HTTP Mock Test Pattern (mockito)
```rust
#[tokio::test]
async fn test_api_endpoint() {
    let mut server = Server::new_async().await;

    let mock = mock("POST", "/api/endpoint")
        .with_status(200)
        .with_body(r#"{"success": true}"#)
        .create_async()
        .await;

    // Make request to server.url()
    // Verify mock was called

    drop(mock);
}
```

## Test Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use `Drop` traits or `defer` for cleanup
3. **Naming**: Use descriptive test names (test_feature_scenario_expected)
4. **Coverage**: Aim for >80% code coverage on critical paths
5. **Performance**: Keep unit tests fast (< 100ms each)
6. **Async**: Use `tokio::test` for async functions
7. **Mocking**: Use mockito for HTTP, avoid real network calls in tests

## Performance Benchmarks

Target performance (single-threaded):
- Key derivation: < 100ms
- Encrypt 1KB: < 10ms
- Decrypt 1KB: < 10ms
- Encrypt 1MB: < 100ms
- Decrypt 1MB: < 100ms

Run benchmarks:
```bash
cd src-tauri
cargo test --lib --release test_encryption_performance -- --nocapture
cargo test --lib --release test_key_derivation_performance -- --nocapture
```

## Security Testing

Tests verify:
- ✅ Key derivation (HKDF-SHA256, 32-byte keys)
- ✅ Encryption (AES-256-GCM)
- ✅ Nonce uniqueness (random per encryption)
- ✅ Checksum validation (SHA-256)
- ✅ Key isolation (per-data-type keys)
- ✅ Memory safety (zeroize on drop)
- ✅ Panic safety (cleanup on panic)

## Troubleshooting

### Compilation Errors
```bash
# Update dependencies
cargo update

# Clean build cache
cargo clean
cargo test --lib
```

### Test Failures
```bash
# Run failing test with backtrace
RUST_BACKTRACE=full cargo test --lib failing_test_name -- --exact
```

### Missing Dependencies
```bash
# Check Cargo.toml has all dev-dependencies
cat Cargo.toml | grep -A 10 "dev-dependencies"
```

## Next Steps

1. Add mutation testing (cargo-mutants)
2. Add property-based testing (proptest)
3. Add fuzzing tests (cargo-fuzz)
4. Add memory leak detection (valgrind)
5. Add ASAN/MSAN sanitizers
