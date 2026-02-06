//! Filter engine - applies filters to emails

use super::{EmailFilter, FilterAction, FilterActionType, MatchLogic};
use crate::db::{Database, DbResult, Email};
use std::sync::Arc;

/// Filter engine that applies rules to emails
pub struct FilterEngine {
    db: Arc<Database>,
}

impl FilterEngine {
    /// Create a new filter engine
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Apply all enabled filters to an email
    /// Returns the list of actions to perform
    pub async fn apply_filters(&self, email: &Email) -> DbResult<Vec<FilterAction>> {
        // Get all enabled filters for this account, sorted by priority
        let filters = self.get_enabled_filters(email.account_id).await?;

        let mut actions_to_perform = Vec::new();

        for filter in filters {
            if self.test_filter(&filter, email) {
                // Filter matched! Collect actions
                actions_to_perform.extend(filter.actions.clone());

                // Update filter statistics
                self.update_filter_stats(filter.id).await?;

                log::info!(
                    "Filter '{}' (ID: {}) matched email '{}' (ID: {})",
                    filter.name,
                    filter.id,
                    email.subject,
                    email.id
                );
            }
        }

        Ok(actions_to_perform)
    }

    /// Test if a single filter matches an email
    pub fn test_filter(&self, filter: &EmailFilter, email: &Email) -> bool {
        if filter.conditions.is_empty() {
            return false;
        }

        match filter.match_logic {
            MatchLogic::All => {
                // All conditions must match (AND)
                filter.conditions.iter().all(|cond| cond.matches(email))
            }
            MatchLogic::Any => {
                // Any condition must match (OR)
                filter.conditions.iter().any(|cond| cond.matches(email))
            }
        }
    }

    /// Execute actions on an email
    pub async fn execute_actions(
        &self,
        email_id: i64,
        actions: Vec<FilterAction>,
    ) -> DbResult<()> {
        for action in actions {
            match action.action {
                FilterActionType::MoveToFolder => {
                    if let Some(folder_id) = action.folder_id {
                        self.move_email_to_folder(email_id, folder_id).await?;
                    }
                }
                FilterActionType::AddLabel => {
                    if let Some(label) = action.label {
                        self.add_email_label(email_id, &label).await?;
                    }
                }
                FilterActionType::MarkAsRead => {
                    self.db.update_email_flags(email_id, Some(true), None, None)?;
                }
                FilterActionType::MarkAsStarred => {
                    self.db.update_email_flags(email_id, None, Some(true), None)?;
                }
                FilterActionType::MarkAsSpam => {
                    self.mark_email_as_spam(email_id).await?;
                }
                FilterActionType::Delete => {
                    self.db.update_email_flags(email_id, None, None, Some(true))?;
                }
                FilterActionType::Archive => {
                    self.archive_email(email_id).await?;
                }
            }
        }

        Ok(())
    }

    /// Get all enabled filters for an account
    async fn get_enabled_filters(&self, account_id: i64) -> DbResult<Vec<EmailFilter>> {
        let sql = r#"
            SELECT id, account_id, name, description, is_enabled, priority,
                   match_logic, conditions, actions, matched_count, last_matched_at,
                   created_at, updated_at
            FROM email_filters
            WHERE account_id = ?1 AND is_enabled = 1
            ORDER BY priority ASC, id ASC
        "#;

        self.db.query(sql, [account_id], |row| {
            let conditions_json: String = row.get(7)?;
            let actions_json: String = row.get(8)?;
            let match_logic_str: String = row.get(6)?;

            let conditions = serde_json::from_str(&conditions_json)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let actions = serde_json::from_str(&actions_json)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let match_logic = MatchLogic::from_str(&match_logic_str)
                .unwrap_or(MatchLogic::All);

            Ok(EmailFilter {
                id: row.get(0)?,
                account_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                is_enabled: row.get(4)?,
                priority: row.get(5)?,
                match_logic,
                conditions,
                actions,
                matched_count: row.get(9)?,
                last_matched_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
    }

    /// Update filter match statistics
    async fn update_filter_stats(&self, filter_id: i64) -> DbResult<()> {
        let sql = r#"
            UPDATE email_filters
            SET matched_count = matched_count + 1,
                last_matched_at = datetime('now')
            WHERE id = ?1
        "#;
        self.db.execute(sql, [filter_id])?;
        Ok(())
    }

    /// Move email to a different folder
    async fn move_email_to_folder(&self, email_id: i64, target_folder_id: i64) -> DbResult<()> {
        // Update email's folder_id in database
        let sql = "UPDATE emails SET folder_id = ?1 WHERE id = ?2";
        self.db.execute(sql, rusqlite::params![target_folder_id, email_id])?;
        Ok(())
    }

    /// Add label to email
    async fn add_email_label(&self, email_id: i64, label: &str) -> DbResult<()> {
        // Get current labels
        let email = self.db.get_email(email_id)?;
        let mut labels: Vec<String> = serde_json::from_str(&email.labels).unwrap_or_default();

        // Add new label if not exists
        if !labels.contains(&label.to_string()) {
            labels.push(label.to_string());
            let labels_json = serde_json::to_string(&labels).unwrap();

            let sql = "UPDATE emails SET labels = ?1 WHERE id = ?2";
            self.db.execute(sql, rusqlite::params![labels_json, email_id])?;
        }

        Ok(())
    }

    /// Mark email as spam
    async fn mark_email_as_spam(&self, email_id: i64) -> DbResult<()> {
        let sql = "UPDATE emails SET is_spam = 1 WHERE id = ?1";
        self.db.execute(sql, [email_id])?;
        Ok(())
    }

    /// Archive email (move to Archive folder)
    async fn archive_email(&self, email_id: i64) -> DbResult<()> {
        // Get email to find its account
        let email = self.db.get_email(email_id)?;

        // Find Archive folder for this account
        let sql = r#"
            SELECT id FROM folders
            WHERE account_id = ?1 AND folder_type = 'archive'
            LIMIT 1
        "#;

        let archive_folder_id: Option<i64> = self.db
            .query(sql, [email.account_id], |row| row.get(0))
            .ok()
            .and_then(|mut results| results.pop());

        if let Some(folder_id) = archive_folder_id {
            self.move_email_to_folder(email_id, folder_id).await?;
        } else {
            log::warn!("No archive folder found for account {}", email.account_id);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filters::{ConditionField, ConditionOperator, FilterCondition};

    #[test]
    fn test_filter_matching_all_conditions() {
        let db = Database::in_memory().unwrap();
        let engine = FilterEngine::new(Arc::new(db));

        let filter = EmailFilter {
            id: 1,
            account_id: 1,
            name: "Test Filter".to_string(),
            description: None,
            is_enabled: true,
            priority: 0,
            match_logic: MatchLogic::All,
            conditions: vec![
                FilterCondition {
                    field: ConditionField::From,
                    operator: ConditionOperator::Contains,
                    value: "example".to_string(),
                },
                FilterCondition {
                    field: ConditionField::Subject,
                    operator: ConditionOperator::Contains,
                    value: "test".to_string(),
                },
            ],
            actions: vec![],
            matched_count: 0,
            last_matched_at: None,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
        };

        let email = Email {
            id: 1,
            account_id: 1,
            folder_id: 1,
            message_id: "test".to_string(),
            uid: 1,
            from_address: "user@example.com".to_string(),
            from_name: None,
            to_addresses: "".to_string(),
            cc_addresses: "".to_string(),
            bcc_addresses: "".to_string(),
            reply_to: None,
            subject: "This is a test subject".to_string(),
            preview: "".to_string(),
            body_text: None,
            body_html: None,
            date: "2024-01-01".to_string(),
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

        assert!(engine.test_filter(&filter, &email));
    }
}
