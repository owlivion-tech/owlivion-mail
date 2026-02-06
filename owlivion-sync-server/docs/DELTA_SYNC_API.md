# Delta Sync API Documentation

## Overview

Delta Sync API allows clients to synchronize only changed data instead of uploading/downloading entire datasets. This dramatically reduces bandwidth usage and improves sync performance.

**Key Features:**
- ✅ Record-level change tracking (insert, update, delete)
- ✅ Timestamp-based delta queries
- ✅ Pagination support (up to 1000 records per request)
- ✅ Conflict detection (Last-Write-Wins)
- ✅ Tombstone deletion tracking (90-day retention)
- ✅ Bandwidth savings: 60-90% reduction

---

## Authentication

All delta sync endpoints require Bearer token authentication:

```http
Authorization: Bearer <access_token>
```

---

## Endpoints

### 1. Upload Delta Changes

**Endpoint:** `POST /api/v1/sync/:data_type/delta`

**Description:** Upload changed records (insert, update, delete) since last sync.

**Parameters:**
- `data_type` (path): Data type to sync
  - Valid values: `accounts`, `contacts`, `preferences`, `signatures`

**Request Body:**
```json
{
  "changes": [
    {
      "record_id": "contact-123",
      "change_type": "insert",
      "encrypted_record": "base64-encrypted-data...",
      "record_nonce": "base64-nonce...",
      "record_checksum": "sha256-checksum-64-chars"
    },
    {
      "record_id": "contact-456",
      "change_type": "update",
      "encrypted_record": "base64-encrypted-data...",
      "record_nonce": "base64-nonce...",
      "record_checksum": "sha256-checksum-64-chars"
    },
    {
      "record_id": "contact-789",
      "change_type": "delete"
    }
  ],
  "device_id": "device-uuid",
  "client_timestamp": "2026-02-06T10:30:00Z"
}
```

**Change Types:**
- `insert`: New record
- `update`: Modified existing record
- `delete`: Deleted record (no encrypted_record needed)

**Constraints:**
- Maximum 1000 changes per request
- `encrypted_record`, `record_nonce`, `record_checksum` required for insert/update
- `record_checksum` must be SHA-256 (64 hex chars)
- All encrypted data must be base64-encoded

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data_type": "contacts",
    "version": 42,
    "processed_count": 3,
    "conflict_count": 0,
    "synced_at": "2026-02-06T10:30:05Z"
  }
}
```

**Response with Conflicts (200 OK):**
```json
{
  "success": true,
  "data": {
    "data_type": "contacts",
    "version": 42,
    "processed_count": 2,
    "conflict_count": 1,
    "conflicts": [
      {
        "record_id": "contact-456",
        "server_version": 41,
        "server_timestamp": "2026-02-06T10:29:00Z"
      }
    ],
    "synced_at": "2026-02-06T10:30:05Z"
  }
}
```

**Conflict Resolution:**
- Server uses **Last-Write-Wins (LWW)** based on `client_timestamp`
- If server version is newer, change is rejected and added to `conflicts` array
- Client should fetch latest version and re-apply changes

**Error Responses:**
- `400 Bad Request`: Invalid data_type, empty changes, or validation error
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded (20 requests/minute)

---

### 2. Download Delta Changes

**Endpoint:** `GET /api/v1/sync/:data_type/delta`

**Description:** Download changed records since a specific timestamp.

**Parameters:**
- `data_type` (path): Data type to sync
- `since` (query, required): ISO 8601 timestamp (e.g., `2026-02-06T10:00:00Z`)
- `limit` (query, optional): Max records per request (default: 100, max: 1000)
- `offset` (query, optional): Pagination offset (default: 0)

**Example Request:**
```http
GET /api/v1/sync/contacts/delta?since=2026-02-06T10:00:00Z&limit=100&offset=0
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data_type": "contacts",
    "since": "2026-02-06T10:00:00Z",
    "changes": [
      {
        "record_id": "contact-123",
        "change_type": "insert",
        "encrypted_record": "base64-encrypted-data...",
        "record_nonce": "base64-nonce...",
        "record_checksum": "sha256-checksum",
        "changed_at": "2026-02-06T10:15:00Z",
        "version": 38,
        "device_id": "device-uuid"
      },
      {
        "record_id": "contact-456",
        "change_type": "update",
        "encrypted_record": "base64-encrypted-data...",
        "record_nonce": "base64-nonce...",
        "record_checksum": "sha256-checksum",
        "changed_at": "2026-02-06T10:20:00Z",
        "version": 39,
        "device_id": "device-uuid"
      }
    ],
    "deleted": [
      {
        "record_id": "contact-789",
        "deleted_at": "2026-02-06T10:25:00Z",
        "deleted_by_device_id": "device-uuid"
      }
    ],
    "pagination": {
      "total_changes": 150,
      "total_deleted": 5,
      "limit": 100,
      "offset": 0,
      "returned_count": 2,
      "has_more": true,
      "next_offset": 100
    }
  }
}
```

**Pagination Logic:**
1. First request: `offset=0`
2. Check `pagination.has_more`
3. If `true`, use `pagination.next_offset` for next request
4. Repeat until `has_more` is `false`

**Error Responses:**
- `400 Bad Request`: Missing `since` parameter or invalid timestamp
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded (30 requests/minute)

---

### 3. Get Deleted Records

**Endpoint:** `GET /api/v1/sync/:data_type/deleted`

**Description:** Get only deleted records (tombstones) since a timestamp.

**Parameters:**
- `data_type` (path): Data type
- `since` (query, required): ISO 8601 timestamp
- `limit` (query, optional): Max records (default: 100, max: 1000)
- `offset` (query, optional): Pagination offset (default: 0)

**Example Request:**
```http
GET /api/v1/sync/contacts/deleted?since=2026-02-06T10:00:00Z
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data_type": "contacts",
    "since": "2026-02-06T10:00:00Z",
    "deleted": [
      {
        "record_id": "contact-789",
        "deleted_at": "2026-02-06T10:25:00Z",
        "deleted_by_device_id": "device-uuid"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 100,
      "offset": 0,
      "returned_count": 1,
      "has_more": false,
      "next_offset": null
    }
  }
}
```

**Tombstone Retention:**
- Deleted records are kept for **90 days**
- After 90 days, tombstones are automatically cleaned up
- Clients syncing after 90 days should perform full sync

---

## Client Integration Guide

### 1. Initial Sync (First Time)

```typescript
// Use full sync for initial data
await syncClient.uploadFullSync('contacts', encryptedData);
```

### 2. Delta Sync (Subsequent Syncs)

```typescript
// Get last sync timestamp from local storage
const lastSyncTimestamp = localStorage.getItem('last_sync_contacts');

// Upload local changes
const localChanges = db.getChangedContacts(lastSyncTimestamp);
const uploadResponse = await syncClient.uploadDelta('contacts', {
  changes: localChanges,
  device_id: deviceId,
  client_timestamp: new Date().toISOString()
});

// Handle conflicts
if (uploadResponse.conflict_count > 0) {
  for (const conflict of uploadResponse.conflicts) {
    // Fetch server version and re-apply changes
    const serverData = await syncClient.downloadDelta('contacts', {
      since: conflict.server_timestamp
    });

    // Merge and re-upload
    const merged = mergeConflicts(localChanges, serverData);
    await syncClient.uploadDelta('contacts', merged);
  }
}

// Download server changes
const serverChanges = await syncClient.downloadDelta('contacts', {
  since: lastSyncTimestamp,
  limit: 100,
  offset: 0
});

// Apply changes to local database
for (const change of serverChanges.changes) {
  if (change.change_type === 'insert' || change.change_type === 'update') {
    const decrypted = await decrypt(change.encrypted_record, change.record_nonce);
    db.upsertContact(change.record_id, decrypted);
  }
}

// Apply deletions
for (const deleted of serverChanges.deleted) {
  db.deleteContact(deleted.record_id);
}

// Handle pagination
let offset = serverChanges.pagination.next_offset;
while (offset !== null) {
  const nextPage = await syncClient.downloadDelta('contacts', {
    since: lastSyncTimestamp,
    limit: 100,
    offset: offset
  });

  // Apply changes...

  offset = nextPage.pagination.next_offset;
}

// Update last sync timestamp
localStorage.setItem('last_sync_contacts', new Date().toISOString());
```

### 3. Rust Client Example (Owlivion Mail)

```rust
// src-tauri/src/sync/delta.rs

use crate::sync::api::ApiClient;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct DeltaChange {
    record_id: String,
    change_type: String, // "insert", "update", "delete"
    #[serde(skip_serializing_if = "Option::is_none")]
    encrypted_record: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    record_nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    record_checksum: Option<String>,
}

pub async fn upload_delta_changes(
    api_client: &ApiClient,
    data_type: &str,
    changes: Vec<DeltaChange>,
    device_id: &str,
) -> Result<DeltaUploadResponse, Error> {
    let payload = serde_json::json!({
        "changes": changes,
        "device_id": device_id,
        "client_timestamp": chrono::Utc::now().to_rfc3339(),
    });

    let response = api_client
        .post(&format!("/sync/{}/delta", data_type))
        .json(&payload)
        .send()
        .await?;

    response.json::<DeltaUploadResponse>().await
}

pub async fn download_delta_changes(
    api_client: &ApiClient,
    data_type: &str,
    since: &str,
    limit: usize,
    offset: usize,
) -> Result<DeltaDownloadResponse, Error> {
    let response = api_client
        .get(&format!("/sync/{}/delta", data_type))
        .query(&[
            ("since", since),
            ("limit", &limit.to_string()),
            ("offset", &offset.to_string()),
        ])
        .send()
        .await?;

    response.json::<DeltaDownloadResponse>().await
}
```

---

## Performance Optimization

### Bandwidth Savings

**Full Sync (Before):**
```
Upload: 10MB encrypted contacts blob
Download: 10MB encrypted contacts blob
Total: 20MB
```

**Delta Sync (After):**
```
Upload: 50 changed contacts = 100KB
Download: 30 changed contacts = 60KB
Total: 160KB

Savings: 99.2% bandwidth reduction!
```

### Best Practices

1. **Sync Frequency:**
   - Background sync: Every 15-30 minutes
   - On-demand: When user makes changes
   - After network reconnection

2. **Batch Size:**
   - Upload: 100-500 changes per request
   - Download: 100-500 records per page
   - Use pagination for large datasets

3. **Conflict Resolution:**
   - Implement retry logic for conflicts
   - Show conflict UI for user decision
   - Use LWW for automatic resolution

4. **Error Handling:**
   - Retry on network errors (exponential backoff)
   - Queue failed uploads for later
   - Fall back to full sync if delta fails

5. **Timestamp Management:**
   - Store last sync timestamp per data_type
   - Use server timestamp from response
   - Handle clock skew (server time is source of truth)

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Delta Upload | 20 requests | 1 minute |
| Delta Download | 30 requests | 1 minute |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1707217800
```

---

## Database Schema

### sync_data_changes

```sql
CREATE TABLE sync_data_changes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    data_type VARCHAR(50),
    record_id VARCHAR(255),
    change_type VARCHAR(20), -- insert, update, delete
    encrypted_record BYTEA,
    record_nonce BYTEA,
    record_checksum VARCHAR(64),
    device_id VARCHAR(255),
    version INTEGER,
    changed_at TIMESTAMP,
    client_timestamp TIMESTAMP
);
```

### deleted_records

```sql
CREATE TABLE deleted_records (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    data_type VARCHAR(50),
    record_id VARCHAR(255),
    deleted_at TIMESTAMP,
    deleted_by_device_id VARCHAR(255),
    expires_at TIMESTAMP -- 90 days retention
);
```

---

## Migration Guide

### Running the Migration

```bash
cd owlivion-sync-server/src/db/migrations
chmod +x run-migration.sh
./run-migration.sh 002
```

### Verification

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('sync_data_changes', 'deleted_records');

-- Check functions created
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%changes%';
```

---

## Testing

### Run Tests

```bash
cd owlivion-sync-server
npm test tests/delta-sync.test.js
```

### Manual Testing with curl

**Upload Delta:**
```bash
curl -X POST https://owlivion.com/api/v1/sync/contacts/delta \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "record_id": "contact-001",
        "change_type": "insert",
        "encrypted_record": "dGVzdCBkYXRh",
        "record_nonce": "bm9uY2UxMjM=",
        "record_checksum": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    ],
    "device_id": "test-device-uuid"
  }'
```

**Download Delta:**
```bash
curl -X GET "https://owlivion.com/api/v1/sync/contacts/delta?since=2026-02-06T00:00:00Z&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## FAQ

**Q: When should I use delta sync vs full sync?**
A: Use full sync for initial setup or after 90 days without syncing. Use delta sync for all subsequent syncs.

**Q: What happens if my device is offline for > 90 days?**
A: Deleted records expire after 90 days. You'll need to do a full sync to ensure consistency.

**Q: How are conflicts resolved?**
A: Server uses Last-Write-Wins based on `client_timestamp`. Older changes are rejected.

**Q: Can I sync multiple data types in one request?**
A: No, each data type requires a separate request. However, you can make parallel requests for faster syncing.

**Q: What's the maximum batch size?**
A: 1000 changes per upload request, 1000 records per download page.

---

## Support

For issues or questions:
- GitHub: https://github.com/owlivion/owlivion-mail/issues
- Docs: https://docs.owlivion.com/sync-api
- Email: support@owlivion.com
