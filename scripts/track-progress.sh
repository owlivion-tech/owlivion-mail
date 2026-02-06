#!/bin/bash
# Owlivion Mail - Progress Tracking Script
# Auto-generates statistics for TODO.md

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Owlivion Mail - Progress Tracking${NC}"
echo "================================================"

# 1. Code Statistics
echo -e "\n${GREEN}📝 Code Statistics${NC}"
RUST_LINES=$(find src-tauri/src -name "*.rs" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
TS_LINES=$(find src -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
TOTAL_FILES=$(find src src-tauri/src -name "*.rs" -o -name "*.ts" -o -name "*.tsx" | wc -l)

echo "  - Rust code: $(printf '%s' "$RUST_LINES" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta') lines"
echo "  - TypeScript/React: $(printf '%s' "$TS_LINES" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta') lines"
echo "  - Total files: $TOTAL_FILES"

# 2. Test Coverage
echo -e "\n${GREEN}✅ Test Coverage${NC}"
cd src-tauri
TEST_OUTPUT=$(cargo test --no-fail-fast 2>&1 || true)
TESTS_RUN=$(echo "$TEST_OUTPUT" | grep -oP "running \K\d+" | head -1)

# Get test results from the main test result line (first FAILED or ok line)
TEST_RESULT_LINE=$(echo "$TEST_OUTPUT" | grep "test result:" | head -1)
TESTS_PASSED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= passed)")
TESTS_FAILED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= failed)")
TESTS_IGNORED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= ignored)")

# Set defaults if empty
TESTS_RUN=${TESTS_RUN:-0}
TESTS_PASSED=${TESTS_PASSED:-0}
TESTS_FAILED=${TESTS_FAILED:-0}
TESTS_IGNORED=${TESTS_IGNORED:-0}

if [ "$TESTS_RUN" -gt 0 ]; then
    PASS_RATE=$(awk -v passed="$TESTS_PASSED" -v total="$TESTS_RUN" 'BEGIN {printf "%.1f", (passed / total) * 100}')
    echo "  - Total tests: $TESTS_RUN"
    echo "  - Passed: $TESTS_PASSED ($PASS_RATE%)"
    echo "  - Failed: $TESTS_FAILED"
    echo "  - Ignored: $TESTS_IGNORED"
else
    echo "  - No tests found or cargo test failed to run"
fi
cd ..

# 3. Git Statistics
echo -e "\n${GREEN}📦 Git Statistics${NC}"
TOTAL_COMMITS=$(git rev-list --count HEAD)
TODAY_COMMITS=$(git log --since="$(date +%Y-%m-%d) 00:00:00" --oneline | wc -l)
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null | wc -l || echo "0")

echo "  - Total commits: $TOTAL_COMMITS"
echo "  - Today's commits: $TODAY_COMMITS"
echo "  - Files changed (last commit): $CHANGED_FILES"

# 4. Recent Activity
echo -e "\n${GREEN}🔥 Recent Activity (Last 5 commits)${NC}"
git log -5 --pretty=format:"  %C(yellow)%h%Creset %C(blue)%ad%Creset - %s" --date=short

# 5. File Size Statistics
echo -e "\n\n${GREEN}💾 Repository Size${NC}"
REPO_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "  - Total size: $REPO_SIZE"

# 6. Documentation Coverage
echo -e "\n${GREEN}📚 Documentation${NC}"
DOC_FILES=$(find docs -name "*.md" 2>/dev/null | wc -l || echo "0")
DOC_LINES=$(find docs -name "*.md" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
echo "  - Documentation files: $DOC_FILES"
echo "  - Documentation lines: $(printf '%s' "$DOC_LINES" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"

# 7. TODO Progress
echo -e "\n${GREEN}📋 TODO Progress${NC}"
TODO_COMPLETED=$(grep -c "^\- \[x\]" TODO.md 2>/dev/null || echo "0")
TODO_PENDING=$(grep -c "^\- \[ \]" TODO.md 2>/dev/null || echo "0")
TODO_TOTAL=$((TODO_COMPLETED + TODO_PENDING))

if [ "$TODO_TOTAL" -gt 0 ]; then
    TODO_PERCENT=$(awk -v completed="$TODO_COMPLETED" -v total="$TODO_TOTAL" 'BEGIN {printf "%.1f", (completed / total) * 100}')
    echo "  - Completed tasks: $TODO_COMPLETED / $TODO_TOTAL ($TODO_PERCENT%)"
    echo "  - Pending tasks: $TODO_PENDING"
else
    echo "  - No TODO items tracked"
fi

echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}✨ Tracking complete!${NC}\n"

# 8. Export to JSON for automation
cat > .progress-stats.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "code": {
    "rust_lines": ${RUST_LINES:-0},
    "typescript_lines": ${TS_LINES:-0},
    "total_files": ${TOTAL_FILES:-0}
  },
  "tests": {
    "total": ${TESTS_RUN:-0},
    "passed": ${TESTS_PASSED:-0},
    "failed": ${TESTS_FAILED:-0},
    "ignored": ${TESTS_IGNORED:-0},
    "pass_rate": ${PASS_RATE:-0.0}
  },
  "git": {
    "total_commits": ${TOTAL_COMMITS:-0},
    "today_commits": ${TODAY_COMMITS:-0},
    "changed_files": ${CHANGED_FILES:-0}
  },
  "documentation": {
    "files": ${DOC_FILES:-0},
    "lines": ${DOC_LINES:-0}
  },
  "todo": {
    "completed": ${TODO_COMPLETED:-0},
    "pending": ${TODO_PENDING:-0},
    "completion_rate": ${TODO_PERCENT:-0.0}
  }
}
EOF

echo -e "${YELLOW}📄 Stats exported to .progress-stats.json${NC}\n"
