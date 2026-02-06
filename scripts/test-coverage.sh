#!/bin/bash
# Test Coverage Report Generator
# Generates detailed test coverage statistics

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/src-tauri"

echo "🧪 Running test suite with coverage analysis..."
echo "================================================"

# Run tests and capture output
TEST_OUTPUT=$(cargo test --no-fail-fast -- --test-threads=1 2>&1 || true)

# Parse test results
TESTS_RUN=$(echo "$TEST_OUTPUT" | grep -oP "running \K\d+" | head -1)

# Get test results from the main test result line
TEST_RESULT_LINE=$(echo "$TEST_OUTPUT" | grep "test result:" | head -1)
TESTS_PASSED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= passed)")
TESTS_FAILED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= failed)")
TESTS_IGNORED=$(echo "$TEST_RESULT_LINE" | grep -oP "\d+(?= ignored)")

# Set defaults if empty
TESTS_RUN=${TESTS_RUN:-0}
TESTS_PASSED=${TESTS_PASSED:-0}
TESTS_FAILED=${TESTS_FAILED:-0}
TESTS_IGNORED=${TESTS_IGNORED:-0}

# Calculate metrics
if [ "$TESTS_RUN" -gt 0 ]; then
    PASS_RATE=$(awk -v passed="$TESTS_PASSED" -v total="$TESTS_RUN" 'BEGIN {printf "%.2f", (passed / total) * 100}')
    FAIL_RATE=$(awk -v failed="$TESTS_FAILED" -v total="$TESTS_RUN" 'BEGIN {printf "%.2f", (failed / total) * 100}')
else
    PASS_RATE="0.00"
    FAIL_RATE="0.00"
fi

# Module breakdown
echo ""
echo "📊 Test Results Summary"
echo "================================================"
echo "Total Tests:    $TESTS_RUN"
echo "✅ Passed:      $TESTS_PASSED ($PASS_RATE%)"
echo "❌ Failed:      $TESTS_FAILED ($FAIL_RATE%)"
echo "⏭️  Ignored:     $TESTS_IGNORED"
echo ""

# Test by module
echo "📦 Tests by Module"
echo "================================================"
echo "$TEST_OUTPUT" | grep -E "test.*::" | sed 's/test //' | sed 's/ \.\.\. .*//' | cut -d: -f1-2 | sort | uniq -c | sort -rn | head -10

# Failed tests detail
if [ "$TESTS_FAILED" -gt 0 ]; then
    echo ""
    echo "❌ Failed Tests Detail"
    echo "================================================"
    echo "$TEST_OUTPUT" | grep -A 3 "FAILED"
fi

# Save report
REPORT_FILE="../.test-coverage-report.txt"
cat > "$REPORT_FILE" << EOF
Test Coverage Report
Generated: $(date -Iseconds)
================================================

Summary:
  Total:   $TESTS_RUN
  Passed:  $TESTS_PASSED ($PASS_RATE%)
  Failed:  $TESTS_FAILED ($FAIL_RATE%)
  Ignored: $TESTS_IGNORED

Top Test Modules:
$(echo "$TEST_OUTPUT" | grep -E "test.*::" | sed 's/test //' | sed 's/ \.\.\. .*//' | cut -d: -f1-2 | sort | uniq -c | sort -rn | head -10)

EOF

echo ""
echo "💾 Report saved to: $REPORT_FILE"
echo ""

# Exit with proper code
if [ "$TESTS_FAILED" -gt 0 ]; then
    echo "⚠️  Warning: $TESTS_FAILED tests failed"
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi
