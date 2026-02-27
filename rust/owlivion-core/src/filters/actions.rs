//! Filter actions to perform on matched emails

use serde::{Deserialize, Serialize};

/// Action to perform when filter matches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterAction {
    pub action: FilterActionType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

/// Types of actions that can be performed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterActionType {
    /// Move email to a specific folder
    MoveToFolder,
    /// Add a label to the email
    AddLabel,
    /// Mark email as read
    MarkAsRead,
    /// Mark email as starred
    MarkAsStarred,
    /// Mark email as spam
    MarkAsSpam,
    /// Delete email (move to trash)
    Delete,
    /// Archive email
    Archive,
}

impl FilterAction {
    /// Create a move to folder action
    pub fn move_to_folder(folder_id: i64) -> Self {
        Self {
            action: FilterActionType::MoveToFolder,
            folder_id: Some(folder_id),
            label: None,
        }
    }

    /// Create an add label action
    pub fn add_label(label: impl Into<String>) -> Self {
        Self {
            action: FilterActionType::AddLabel,
            folder_id: None,
            label: Some(label.into()),
        }
    }

    /// Create a mark as read action
    pub fn mark_as_read() -> Self {
        Self {
            action: FilterActionType::MarkAsRead,
            folder_id: None,
            label: None,
        }
    }

    /// Create a mark as starred action
    pub fn mark_as_starred() -> Self {
        Self {
            action: FilterActionType::MarkAsStarred,
            folder_id: None,
            label: None,
        }
    }

    /// Create a mark as spam action
    pub fn mark_as_spam() -> Self {
        Self {
            action: FilterActionType::MarkAsSpam,
            folder_id: None,
            label: None,
        }
    }

    /// Create a delete action
    pub fn delete() -> Self {
        Self {
            action: FilterActionType::Delete,
            folder_id: None,
            label: None,
        }
    }

    /// Create an archive action
    pub fn archive() -> Self {
        Self {
            action: FilterActionType::Archive,
            folder_id: None,
            label: None,
        }
    }
}
