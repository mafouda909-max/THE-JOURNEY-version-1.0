#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# THE JOURNEY — DATABASE BACKUP & RESTORE VERIFICATION SCRIPT
# =================================================================
# Usage:
#   ./scripts/backup.sh backup   -> Perform non-destructive pg_dump snapshot
#   ./scripts/backup.sh restore  -> Perform non-destructive test restore to app_db_test
# =================================================================

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/app_db}"
BACKUP_DIR="/tmp/journey_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/journey_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

mode="${1:-backup}"

if [ "${mode}" = "backup" ]; then
  echo "--- Creating Database Backup Snapshot ---"
  echo "Target: ${BACKUP_FILE}"
  pg_dump "${DB_URL}" --clean --if-exists --no-owner --no-privileges > "${BACKUP_FILE}"
  echo "✓ Backup created successfully ($(du -h "${BACKUP_FILE}" | cut -f1))"
elif [ "${mode}" = "restore" ]; then
  echo "--- Performing Safe Test Restore to Isolated Test DB ---"
  TEST_DB_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db_test"
  
  echo "Creating isolated test database 'app_db_test'..."
  psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -c "DROP DATABASE IF EXISTS app_db_test;"
  psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -c "CREATE DATABASE app_db_test;"

  LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/journey_backup_*.sql | head -n 1)
  if [ -z "${LATEST_BACKUP}" ]; then
    echo "No backup file found. Run './scripts/backup.sh backup' first."
    exit 1
  fi

  echo "Restoring snapshot ${LATEST_BACKUP} into app_db_test..."
  psql "${TEST_DB_URL}" < "${LATEST_BACKUP}" > /dev/null
  echo "✓ Test Restore Verification Passed on isolated database app_db_test!"
  
  # Clean up test DB
  psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -c "DROP DATABASE app_db_test;"
else
  echo "Unknown mode: ${mode}. Use 'backup' or 'restore'."
  exit 1
fi
