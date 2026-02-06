//! Filter condition matching logic

use crate::db::Email;
use serde::{Deserialize, Serialize};

/// Filter condition to match against emails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: ConditionField,
    pub operator: ConditionOperator,
    pub value: String,
}

/// Email fields that can be filtered
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionField {
    From,
    To,
    Subject,
    Body,
    HasAttachment,
}

/// Comparison operators for conditions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionOperator {
    Contains,
    NotContains,
    Equals,
    NotEquals,
    StartsWith,
    EndsWith,
}

impl FilterCondition {
    /// Test if this condition matches the given email
    pub fn matches(&self, email: &Email) -> bool {
        let field_value = self.get_field_value(email);
        let search_value = self.value.to_lowercase();

        match self.operator {
            ConditionOperator::Contains => field_value.contains(&search_value),
            ConditionOperator::NotContains => !field_value.contains(&search_value),
            ConditionOperator::Equals => field_value == search_value,
            ConditionOperator::NotEquals => field_value != search_value,
            ConditionOperator::StartsWith => field_value.starts_with(&search_value),
            ConditionOperator::EndsWith => field_value.ends_with(&search_value),
        }
    }

    /// Extract field value from email
    fn get_field_value(&self, email: &Email) -> String {
        match self.field {
            ConditionField::From => {
                format!("{} {}", email.from_address, email.from_name.as_deref().unwrap_or(""))
                    .to_lowercase()
            }
            ConditionField::To => email.to_addresses.to_lowercase(),
            ConditionField::Subject => email.subject.to_lowercase(),
            ConditionField::Body => {
                let body_text = email.body_text.as_deref().unwrap_or("");
                let body_html = email.body_html.as_deref().unwrap_or("");
                format!("{} {}", body_text, body_html).to_lowercase()
            }
            ConditionField::HasAttachment => {
                if email.has_attachments {
                    "true".to_string()
                } else {
                    "false".to_string()
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_email() -> Email {
        Email {
            id: 1,
            account_id: 1,
            folder_id: 1,
            message_id: "test@example.com".to_string(),
            uid: 1,
            from_address: "sender@example.com".to_string(),
            from_name: Some("John Doe".to_string()),
            to_addresses: "recipient@example.com".to_string(),
            cc_addresses: "".to_string(),
            bcc_addresses: "".to_string(),
            reply_to: None,
            subject: "Test Subject".to_string(),
            preview: "Test preview".to_string(),
            body_text: Some("This is a test email body".to_string()),
            body_html: None,
            date: "2024-01-01T00:00:00Z".to_string(),
            is_read: false,
            is_starred: false,
            is_deleted: false,
            is_spam: false,
            is_draft: false,
            is_answered: false,
            is_forwarded: false,
            has_attachments: true,
            has_inline_images: false,
            thread_id: None,
            in_reply_to: None,
            references_header: None,
            priority: 3,
            labels: "[]".to_string(),
        }
    }

    #[test]
    fn test_from_contains() {
        let email = create_test_email();
        let condition = FilterCondition {
            field: ConditionField::From,
            operator: ConditionOperator::Contains,
            value: "sender".to_string(),
        };
        assert!(condition.matches(&email));
    }

    #[test]
    fn test_subject_equals() {
        let email = create_test_email();
        let condition = FilterCondition {
            field: ConditionField::Subject,
            operator: ConditionOperator::Equals,
            value: "test subject".to_string(),
        };
        assert!(condition.matches(&email));
    }

    #[test]
    fn test_has_attachment() {
        let email = create_test_email();
        let condition = FilterCondition {
            field: ConditionField::HasAttachment,
            operator: ConditionOperator::Equals,
            value: "true".to_string(),
        };
        assert!(condition.matches(&email));
    }
}
