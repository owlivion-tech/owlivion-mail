//! Email filtering system
//!
//! Provides Gmail-like filter rules with conditions and actions.

pub mod actions;
pub mod conditions;
pub mod engine;

pub use actions::{FilterAction, FilterActionType};
pub use conditions::{FilterCondition, ConditionField, ConditionOperator};
pub use engine::FilterEngine;

use serde::{Deserialize, Serialize};

/// Email filter rule stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailFilter {
    pub id: i64,
    pub account_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
    pub priority: i32,
    pub match_logic: MatchLogic,
    pub conditions: Vec<FilterCondition>,
    pub actions: Vec<FilterAction>,
    pub matched_count: i32,
    pub last_matched_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// New filter for insertion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEmailFilter {
    pub account_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
    pub priority: i32,
    pub match_logic: MatchLogic,
    pub conditions: Vec<FilterCondition>,
    pub actions: Vec<FilterAction>,
}

/// Match logic for multiple conditions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchLogic {
    All, // AND - all conditions must match
    Any, // OR - any condition must match
}

impl MatchLogic {
    pub fn as_str(&self) -> &'static str {
        match self {
            MatchLogic::All => "all",
            MatchLogic::Any => "any",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "all" => Ok(MatchLogic::All),
            "any" => Ok(MatchLogic::Any),
            _ => Err(format!("Invalid match logic: {}", s)),
        }
    }
}
