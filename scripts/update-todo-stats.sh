#!/bin/bash
# Auto-update TODO.md with latest statistics
# Run this after significant changes

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
TODAY=$(date "+%Y-%m-%d")

# Generate stats
bash scripts/track-progress.sh > /dev/null 2>&1

# Load stats from JSON
if [ -f .progress-stats.json ]; then
    RUST_LINES=$(jq -r '.code.rust_lines' .progress-stats.json)
    TS_LINES=$(jq -r '.code.typescript_lines' .progress-stats.json)
    TOTAL_FILES=$(jq -r '.code.total_files' .progress-stats.json)
    TESTS_PASSED=$(jq -r '.tests.passed' .progress-stats.json)
    TESTS_FAILED=$(jq -r '.tests.failed' .progress-stats.json)
    TESTS_IGNORED=$(jq -r '.tests.ignored' .progress-stats.json)
    PASS_RATE=$(jq -r '.tests.pass_rate' .progress-stats.json)
    TOTAL_COMMITS=$(jq -r '.git.total_commits' .progress-stats.json)
    DOC_FILES=$(jq -r '.documentation.files' .progress-stats.json)
    DOC_LINES=$(jq -r '.documentation.lines' .progress-stats.json)

    echo "✅ Statistics loaded from .progress-stats.json"
    echo ""
    echo "📊 Project Statistics ($TIMESTAMP)"
    echo "  Code: ${RUST_LINES} Rust + ${TS_LINES} TS = $((RUST_LINES + TS_LINES)) total lines"
    echo "  Tests: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed ($PASS_RATE% pass rate)"
    echo "  Docs: ${DOC_FILES} files, ${DOC_LINES} lines"
    echo "  Git: ${TOTAL_COMMITS} commits"
    echo ""
    echo "💡 Tip: Run 'git add TODO.md && git commit -m \"Update stats\"' to commit changes"
else
    echo "❌ Error: .progress-stats.json not found. Run track-progress.sh first."
    exit 1
fi
