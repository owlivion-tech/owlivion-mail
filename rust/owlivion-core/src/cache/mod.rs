//! Email cache module - LRU cache for fast email access
//!
//! Provides in-memory caching for recently accessed emails with:
//! - LRU eviction (least recently used)
//! - TTL (time-to-live) expiration
//! - Thread-safe async operations
//! - Automatic memory management

use moka::future::Cache;
use std::sync::Arc;
use std::time::Duration;
use crate::db::Email;

/// Email cache configuration
pub struct EmailCacheConfig {
    /// Maximum number of emails to cache
    pub max_capacity: u64,

    /// Time-to-live for cached emails (in seconds)
    pub ttl_secs: u64,

    /// Time-to-idle for cached emails (in seconds)
    pub tti_secs: u64,
}

impl Default for EmailCacheConfig {
    fn default() -> Self {
        Self {
            max_capacity: 500,      // Cache up to 500 emails
            ttl_secs: 1800,         // 30 minutes TTL
            tti_secs: 600,          // 10 minutes idle timeout
        }
    }
}

/// Email cache for fast access to recently viewed emails
#[derive(Clone)]
pub struct EmailCache {
    cache: Arc<Cache<i64, Email>>,
    hits: Arc<std::sync::atomic::AtomicU64>,
    misses: Arc<std::sync::atomic::AtomicU64>,
}

impl EmailCache {
    /// Create a new email cache with default configuration
    pub fn new() -> Self {
        Self::with_config(EmailCacheConfig::default())
    }

    /// Create a new email cache with custom configuration
    pub fn with_config(config: EmailCacheConfig) -> Self {
        let cache = Cache::builder()
            .max_capacity(config.max_capacity)
            .time_to_live(Duration::from_secs(config.ttl_secs))
            .time_to_idle(Duration::from_secs(config.tti_secs))
            .build();

        Self {
            cache: Arc::new(cache),
            hits: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            misses: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// Get an email from cache
    pub async fn get(&self, email_id: i64) -> Option<Email> {
        match self.cache.get(&email_id).await {
            Some(email) => {
                self.hits.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                Some(email)
            }
            None => {
                self.misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                None
            }
        }
    }

    /// Insert an email into cache
    pub async fn insert(&self, email_id: i64, email: Email) {
        self.cache.insert(email_id, email).await;
    }

    /// Remove an email from cache
    pub async fn remove(&self, email_id: i64) {
        self.cache.invalidate(&email_id).await;
    }

    /// Clear all cached emails
    pub async fn clear(&self) {
        self.cache.invalidate_all();
        // Wait for invalidation to complete
        self.cache.run_pending_tasks().await;
    }

    /// Get cache statistics
    pub async fn stats(&self) -> CacheStats {
        let hits = self.hits.load(std::sync::atomic::Ordering::Relaxed);
        let misses = self.misses.load(std::sync::atomic::Ordering::Relaxed);
        let total_requests = hits + misses;
        let hit_rate = if total_requests > 0 {
            (hits as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        CacheStats {
            hits,
            misses,
            total_requests,
            hit_rate,
            entry_count: self.cache.entry_count(),
            weighted_size: self.cache.weighted_size(),
        }
    }

    /// Reset cache statistics
    pub fn reset_stats(&self) {
        self.hits.store(0, std::sync::atomic::Ordering::Relaxed);
        self.misses.store(0, std::sync::atomic::Ordering::Relaxed);
    }
}

impl Default for EmailCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Cache statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CacheStats {
    /// Number of cache hits
    pub hits: u64,

    /// Number of cache misses
    pub misses: u64,

    /// Total cache requests
    pub total_requests: u64,

    /// Cache hit rate (percentage)
    pub hit_rate: f64,

    /// Number of entries in cache
    pub entry_count: u64,

    /// Weighted size of cache
    pub weighted_size: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_insert_and_get() {
        let cache = EmailCache::new();

        // Create a dummy email
        let email = Email {
            id: 1,
            account_id: 1,
            folder_id: 1,
            message_id: "test@example.com".to_string(),
            uid: 100,
            from_address: "sender@example.com".to_string(),
            from_name: Some("Sender".to_string()),
            to_addresses: "recipient@example.com".to_string(),
            cc_addresses: "".to_string(),
            bcc_addresses: "".to_string(),
            reply_to: None,
            subject: "Test Email".to_string(),
            preview: "Test preview".to_string(),
            body_text: Some("Test body".to_string()),
            body_html: None,
            date: "2024-01-01T00:00:00Z".to_string(),
            is_read: false,
            is_starred: false,
            is_deleted: false,
            is_spam: false,
            is_draft: false,
            is_answered: false,
            is_forwarded: false,
            has_attachments: false,
            has_inline_images: false,
            thread_id: None,
            in_reply_to: None,
            references_header: None,
            priority: 3,
            labels: "[]".to_string(),
        };

        // Insert and retrieve
        cache.insert(1, email.clone()).await;
        let retrieved = cache.get(1).await;

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, 1);
    }

    #[tokio::test]
    async fn test_cache_stats() {
        let cache = EmailCache::new();

        let email = Email {
            id: 1,
            account_id: 1,
            folder_id: 1,
            message_id: "test@example.com".to_string(),
            uid: 100,
            from_address: "sender@example.com".to_string(),
            from_name: Some("Sender".to_string()),
            to_addresses: "recipient@example.com".to_string(),
            cc_addresses: "".to_string(),
            bcc_addresses: "".to_string(),
            reply_to: None,
            subject: "Test Email".to_string(),
            preview: "Test preview".to_string(),
            body_text: Some("Test body".to_string()),
            body_html: None,
            date: "2024-01-01T00:00:00Z".to_string(),
            is_read: false,
            is_starred: false,
            is_deleted: false,
            is_spam: false,
            is_draft: false,
            is_answered: false,
            is_forwarded: false,
            has_attachments: false,
            has_inline_images: false,
            thread_id: None,
            in_reply_to: None,
            references_header: None,
            priority: 3,
            labels: "[]".to_string(),
        };

        cache.insert(1, email).await;

        // Hit
        cache.get(1).await;
        // Miss
        cache.get(2).await;

        let stats = cache.stats().await;
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.total_requests, 2);
        assert_eq!(stats.hit_rate, 50.0);
    }

    #[tokio::test]
    async fn test_cache_clear() {
        let cache = EmailCache::new();

        let email = Email {
            id: 1,
            account_id: 1,
            folder_id: 1,
            message_id: "test@example.com".to_string(),
            uid: 100,
            from_address: "sender@example.com".to_string(),
            from_name: Some("Sender".to_string()),
            to_addresses: "recipient@example.com".to_string(),
            cc_addresses: "".to_string(),
            bcc_addresses: "".to_string(),
            reply_to: None,
            subject: "Test Email".to_string(),
            preview: "Test preview".to_string(),
            body_text: Some("Test body".to_string()),
            body_html: None,
            date: "2024-01-01T00:00:00Z".to_string(),
            is_read: false,
            is_starred: false,
            is_deleted: false,
            is_spam: false,
            is_draft: false,
            is_answered: false,
            is_forwarded: false,
            has_attachments: false,
            has_inline_images: false,
            thread_id: None,
            in_reply_to: None,
            references_header: None,
            priority: 3,
            labels: "[]".to_string(),
        };

        cache.insert(1, email).await;
        cache.clear().await;

        let retrieved = cache.get(1).await;
        assert!(retrieved.is_none());
    }
}
