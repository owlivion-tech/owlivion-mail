//! Delta Sync & Compression Tests
//!
//! Comprehensive test suite for delta sync and compression features.
//! Tests performance, correctness, and edge cases.

#[cfg(test)]
mod delta_sync_tests {
    use crate::db::{Database, NewAccount, NewContact};
    use crate::sync::manager::SyncManager;
    use crate::sync::crypto::{gzip_compress, gzip_decompress};
    use std::sync::Arc;

    // ========================================================================
    // Delta Sync Tests
    // ========================================================================

    #[tokio::test]
    async fn test_delta_sync_accounts_only_changed() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db.clone());

        // Initial full sync
        let metadata = db.get_sync_metadata("accounts").unwrap();
        assert!(metadata.is_some());
        let metadata = metadata.unwrap();
        assert!(metadata.last_sync_at.is_none());

        // Add 3 accounts
        for i in 1..=3 {
            let account = NewAccount {
                email: format!("user{}@example.com", i),
                display_name: format!("User {}", i),
                imap_host: "imap.example.com".to_string(),
                imap_port: 993,
                imap_security: "SSL".to_string(),
                imap_username: None,
                smtp_host: "smtp.example.com".to_string(),
                smtp_port: 587,
                smtp_security: "STARTTLS".to_string(),
                smtp_username: None,
                password_encrypted: Some("encrypted".to_string()),
                oauth_provider: None,
                oauth_access_token: None,
                oauth_refresh_token: None,
                oauth_expires_at: None,
                is_default: i == 1,
                signature: "".to_string(),
                sync_days: 30,
                accept_invalid_certs: false,
            };
            db.add_account(&account).unwrap();
        }

        // Simulate first sync - use SQLite datetime format for compatibility
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        db.update_sync_metadata("accounts", Some(&now), Some(1), Some(3), Some(3), Some(0)).unwrap();

        // Wait a full second to ensure timestamp difference (SQLite datetime precision)
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        // Change only 1 account
        let account_to_update = NewAccount {
            email: "user2@example.com".to_string(),
            display_name: "User 2 Updated".to_string(),
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("encrypted".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: false,
            signature: "New signature".to_string(),
            sync_days: 60,
            accept_invalid_certs: false,
        };

        let accounts = db.get_accounts().unwrap();
        let account_id = accounts.iter().find(|a| a.email == "user2@example.com").unwrap().id;
        db.update_account(account_id, &account_to_update).unwrap();

        // Delta sync should return only changed account
        let changed_accounts = db.get_changed_accounts(Some(&now)).unwrap();
        assert_eq!(changed_accounts.len(), 1, "Delta sync should return only 1 changed account");
        assert_eq!(changed_accounts[0].email, "user2@example.com");
        assert_eq!(changed_accounts[0].display_name, "User 2 Updated");

        // Full sync should return all accounts
        let all_accounts = db.get_changed_accounts(None).unwrap();
        assert_eq!(all_accounts.len(), 3, "Full sync should return all 3 accounts");
    }

    #[tokio::test]
    async fn test_delta_sync_contacts_with_deletions() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));

        // Add 5 contacts
        for i in 1..=5 {
            let contact = NewContact {
                account_id: None,
                email: format!("contact{}@example.com", i),
                name: Some(format!("Contact {}", i)),
                company: None,
                phone: None,
                notes: None,
                is_favorite: false,
                avatar_url: None,
            };
            db.upsert_contact(&contact).unwrap();
        }

        // Simulate first sync
        let now = chrono::Utc::now().to_rfc3339();
        db.update_sync_metadata("contacts", Some(&now), Some(1), Some(5), Some(5), Some(0)).unwrap();

        // Wait for timestamp difference (SQLite datetime precision)
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        // Change 1 contact
        let contacts = db.get_all_contacts().unwrap();
        let contact_to_update_id = contacts.iter().find(|c| c.email == "contact2@example.com").unwrap().id;
        let updated_contact = NewContact {
            account_id: None,
            email: "contact2@example.com".to_string(),
            name: Some("Contact 2 Updated".to_string()),
            company: Some("New Company".to_string()),
            phone: None,
            notes: None,
            is_favorite: true,
            avatar_url: None,
        };
        db.upsert_contact(&updated_contact).unwrap();

        // Delete 1 contact (soft delete)
        let contact_to_delete_id = contacts.iter().find(|c| c.email == "contact3@example.com").unwrap().id;
        db.soft_delete_contact(contact_to_delete_id).unwrap();

        // Delta sync should return 1 changed contact
        let changed_contacts = db.get_changed_contacts(Some(&now)).unwrap();
        assert_eq!(changed_contacts.len(), 1, "Delta sync should return 1 changed contact");
        assert_eq!(changed_contacts[0].email, "contact2@example.com");

        // Should return 1 deleted contact ID
        let deleted_contacts = db.get_deleted_contacts(Some(&now)).unwrap();
        assert_eq!(deleted_contacts.len(), 1, "Delta sync should return 1 deleted contact");
        assert_eq!(deleted_contacts[0], contact_to_delete_id);

        // Full sync should return all non-deleted contacts
        let all_contacts = db.get_changed_contacts(None).unwrap();
        assert_eq!(all_contacts.len(), 4, "Full sync should return 4 non-deleted contacts");
    }

    #[test]
    fn test_delta_sync_no_changes() {
        let db = Database::in_memory().expect("Failed to create test database");

        // Add 2 contacts
        for i in 1..=2 {
            let contact = NewContact {
                account_id: None,
                email: format!("contact{}@example.com", i),
                name: Some(format!("Contact {}", i)),
                company: None,
                phone: None,
                notes: None,
                is_favorite: false,
                avatar_url: None,
            };
            db.upsert_contact(&contact).unwrap();
        }

        // Simulate sync
        let now = chrono::Utc::now().to_rfc3339();
        db.update_sync_metadata("contacts", Some(&now), Some(1), Some(2), Some(2), Some(0)).unwrap();

        // Delta sync with no changes should return empty
        let changed_contacts = db.get_changed_contacts(Some(&now)).unwrap();
        assert_eq!(changed_contacts.len(), 0, "No changes should return empty delta");

        let deleted_contacts = db.get_deleted_contacts(Some(&now)).unwrap();
        assert_eq!(deleted_contacts.len(), 0, "No deletions should return empty delta");
    }

    #[test]
    fn test_sync_metadata_tracking() {
        let db = Database::in_memory().expect("Failed to create test database");

        // Initial state - should exist for all data types
        for data_type in ["accounts", "contacts", "preferences", "signatures"] {
            let metadata = db.get_sync_metadata(data_type).unwrap();
            assert!(metadata.is_some(), "Metadata should exist for {}", data_type);
            let metadata = metadata.unwrap();
            assert!(metadata.last_sync_at.is_none(), "Initial sync should be None");
            assert_eq!(metadata.last_sync_version, 0i64, "Initial version should be 0");
        }

        // Update metadata - use SQLite datetime format
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        db.update_sync_metadata("contacts", Some(&now), Some(5), Some(10), Some(8), Some(2)).unwrap();

        // Verify update
        let metadata = db.get_sync_metadata("contacts").unwrap().unwrap();
        assert_eq!(metadata.last_sync_at, Some(now.clone()));
        assert_eq!(metadata.last_sync_version, 5i64);
        assert_eq!(metadata.items_synced, 10i64);
        assert_eq!(metadata.items_changed, 8i64);
        assert_eq!(metadata.items_deleted, 2i64);
        assert_eq!(metadata.sync_status, "idle".to_string());
    }

    // ========================================================================
    // Compression Tests
    // ========================================================================

    #[test]
    fn test_compression_text_data() {
        // JSON-like data (typical sync payload)
        let json_data = r#"
        {
            "accounts": [
                {"email": "user1@example.com", "display_name": "User One", "imap_host": "imap.example.com"},
                {"email": "user2@example.com", "display_name": "User Two", "imap_host": "imap.example.com"},
                {"email": "user3@example.com", "display_name": "User Three", "imap_host": "imap.example.com"}
            ]
        }
        "#.repeat(10); // Simulate larger payload

        let original = json_data.as_bytes();
        let compressed = gzip_compress(original).unwrap();
        let decompressed = gzip_decompress(&compressed).unwrap();

        // Verify correctness
        assert_eq!(original, decompressed.as_slice(), "Decompressed data should match original");

        // Verify compression ratio
        let ratio = (compressed.len() as f64 / original.len() as f64) * 100.0;
        println!("Compression ratio for JSON: {:.2}% ({} → {} bytes)", ratio, original.len(), compressed.len());

        // JSON should compress well (expect < 30% of original size)
        assert!(ratio < 30.0, "JSON data should compress to < 30% (got {:.2}%)", ratio);
    }

    #[test]
    fn test_compression_binary_data() {
        // Random binary data (worst case for compression)
        use ring::rand::{SecureRandom, SystemRandom};
        let rng = SystemRandom::new();
        let mut random_data = vec![0u8; 1024];
        rng.fill(&mut random_data).unwrap();

        let compressed = gzip_compress(&random_data).unwrap();
        let decompressed = gzip_decompress(&compressed).unwrap();

        // Verify correctness
        assert_eq!(random_data, decompressed, "Decompressed data should match original");

        // Random data won't compress well
        let ratio = (compressed.len() as f64 / random_data.len() as f64) * 100.0;
        println!("Compression ratio for random binary: {:.2}% ({} → {} bytes)",
                 ratio, random_data.len(), compressed.len());
    }

    #[test]
    fn test_compression_empty_data() {
        let empty: &[u8] = &[];
        let compressed = gzip_compress(empty).unwrap();
        let decompressed = gzip_decompress(&compressed).unwrap();

        assert_eq!(empty, decompressed.as_slice(), "Empty data should decompress to empty");
        assert!(compressed.len() > 0, "GZIP header should exist even for empty data");
    }

    #[test]
    fn test_compression_large_payload() {
        // Simulate 100KB contact list
        let mut large_json = String::from("{\"contacts\": [");
        for i in 0..1000 {
            if i > 0 { large_json.push(','); }
            large_json.push_str(&format!(
                r#"{{"email":"user{}@example.com","name":"User {}","company":"Company {}"}}"#,
                i, i, i % 50
            ));
        }
        large_json.push_str("]}");

        let original = large_json.as_bytes();
        let original_len = original.len();

        // Compress
        let start = std::time::Instant::now();
        let compressed = gzip_compress(original).unwrap();
        let compress_time = start.elapsed();

        // Decompress
        let start = std::time::Instant::now();
        let decompressed = gzip_decompress(&compressed).unwrap();
        let decompress_time = start.elapsed();

        // Verify correctness
        assert_eq!(original, decompressed.as_slice());

        // Performance report
        let ratio = (compressed.len() as f64 / original_len as f64) * 100.0;
        println!("\n=== Large Payload Compression ({}KB) ===", original_len / 1024);
        println!("  Original size:      {} bytes", original_len);
        println!("  Compressed size:    {} bytes", compressed.len());
        println!("  Compression ratio:  {:.2}%", ratio);
        println!("  Compress time:      {:?}", compress_time);
        println!("  Decompress time:    {:?}", decompress_time);
        println!("  Bandwidth saved:    {}KB", (original_len - compressed.len()) / 1024);

        // Performance assertions
        assert!(ratio < 25.0, "Large JSON should compress to < 25% (got {:.2}%)", ratio);
        assert!(compress_time.as_millis() < 100, "Compression should be < 100ms");
        assert!(decompress_time.as_millis() < 50, "Decompression should be < 50ms");
    }

    #[test]
    fn test_compression_invalid_data() {
        // Invalid GZIP data should fail gracefully
        let invalid_data = b"This is not valid GZIP data!";
        let result = gzip_decompress(invalid_data);

        assert!(result.is_err(), "Invalid GZIP data should return error");
        assert!(result.unwrap_err().contains("GZIP decompression failed"));
    }

    // ========================================================================
    // Integration Tests (Delta Sync + Compression)
    // ========================================================================

    #[test]
    fn test_delta_sync_with_compression_simulation() {
        let db = Database::in_memory().expect("Failed to create test database");

        // Add 100 contacts (simulate existing data)
        for i in 1..=100 {
            let contact = NewContact {
                account_id: None,
                email: format!("contact{}@example.com", i),
                name: Some(format!("Contact {}", i)),
                company: Some(format!("Company {}", i % 10)),
                phone: Some(format!("+1-555-{:04}", i)),
                notes: None,
                is_favorite: i % 10 == 0,
                avatar_url: None,
            };
            db.upsert_contact(&contact).unwrap();
        }

        // Simulate sync - use SQLite datetime format
        let first_sync = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        db.update_sync_metadata("contacts", Some(&first_sync), Some(1), Some(100), Some(100), Some(0)).unwrap();

        // Change only 5 contacts (wait for timestamp difference)
        std::thread::sleep(std::time::Duration::from_secs(1));
        for i in 1..=5 {
            let updated_contact = NewContact {
                account_id: None,
                email: format!("contact{}@example.com", i),
                name: Some(format!("Contact {} UPDATED", i)),
                company: Some("Updated Company".to_string()),
                phone: Some("+1-555-9999".to_string()),
                notes: Some("Recently updated".to_string()),
                is_favorite: true,
                avatar_url: None,
            };
            db.upsert_contact(&updated_contact).unwrap();
        }

        // Delta sync - get only changed
        let changed_contacts = db.get_changed_contacts(Some(&first_sync)).unwrap();
        assert_eq!(changed_contacts.len(), 5, "Delta sync should return 5 changed contacts");

        // Serialize changed contacts (simulate real sync payload)
        let delta_payload = serde_json::to_string(&changed_contacts).unwrap();
        let full_payload = serde_json::to_string(&db.get_all_contacts().unwrap()).unwrap();

        // Compress both payloads
        let delta_compressed = gzip_compress(delta_payload.as_bytes()).unwrap();
        let full_compressed = gzip_compress(full_payload.as_bytes()).unwrap();

        println!("\n=== Delta Sync vs Full Sync ===");
        println!("  Full sync (100 contacts):  {} bytes → {} bytes (compressed)",
                 full_payload.len(), full_compressed.len());
        println!("  Delta sync (5 contacts):   {} bytes → {} bytes (compressed)",
                 delta_payload.len(), delta_compressed.len());
        println!("  Delta bandwidth saved:     {}%",
                 ((full_compressed.len() - delta_compressed.len()) as f64 / full_compressed.len() as f64 * 100.0));

        // Delta should be significantly smaller (expect > 80% bandwidth savings)
        assert!(delta_compressed.len() < full_compressed.len() / 5,
                "Delta sync should save > 80% bandwidth (saved {:.1}%)",
                ((full_compressed.len() - delta_compressed.len()) as f64 / full_compressed.len() as f64 * 100.0));
    }

    #[test]
    fn test_compression_ratio_on_real_sync_data() {
        use serde_json::json;

        // Simulate real AccountSyncData payload
        let account_data = json!({
            "accounts": [
                {
                    "email": "user@gmail.com",
                    "display_name": "John Doe",
                    "imap_host": "imap.gmail.com",
                    "imap_port": 993,
                    "imap_security": "SSL",
                    "smtp_host": "smtp.gmail.com",
                    "smtp_port": 587,
                    "smtp_security": "STARTTLS",
                    "signature": "<p>Best regards,<br>John Doe<br>Software Engineer</p>",
                    "sync_days": 30,
                    "is_default": true,
                    "oauth_provider": "gmail"
                }
            ],
            "synced_at": "2026-02-06T12:00:00Z"
        });

        let json_str = account_data.to_string();
        let original = json_str.as_bytes();
        let compressed = gzip_compress(original).unwrap();
        let decompressed = gzip_decompress(&compressed).unwrap();

        // Verify correctness
        assert_eq!(original, decompressed.as_slice());

        // Real sync data should compress well (60-80% reduction)
        let ratio = (compressed.len() as f64 / original.len() as f64) * 100.0;
        println!("Real sync data compression: {:.2}% ({} → {} bytes)",
                 ratio, original.len(), compressed.len());

        // Small payloads may not compress well due to GZIP header overhead
        // For production, larger payloads (1KB+) compress to < 30%
        assert!(ratio < 80.0, "Sync data should compress reasonably (got {:.2}%)", ratio);
    }
}
