-- Migration 012: Read Receipt support

-- Track if sender requested a read receipt
ALTER TABLE emails ADD COLUMN read_receipt_to TEXT DEFAULT NULL;

-- Track if we sent a read receipt for this email
ALTER TABLE emails ADD COLUMN read_receipt_sent INTEGER NOT NULL DEFAULT 0;
