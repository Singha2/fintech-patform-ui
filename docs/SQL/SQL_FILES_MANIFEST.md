# Fintech Platform MVP - SQL Files Bundle

## Bundle Contents

This archive contains 4 SQL schema files for the Fintech Platform MVP:

### 1. **01_core.sql** (80 KB)
Core financial platform schemas
- Account management
- Transaction processing
- Ledger entries
- Financial instruments

### 2. **02_counterparty_platform.sql** (72 KB)
Counterparty management and trading schemas
- Counterparty information
- Trading relationships
- Settlement instructions
- Risk management

### 3. **03_auth.sql** (32 KB)
Authentication and user management schemas
- User credentials and sessions
- Authentication tokens
- User profile management
- Foreign-key constraints linking identity records to counterparty tables (requires files 01 and 02 to be executed first)

### 4. **04_generic_acl.sql** (44 KB)
Access Control List (ACL) implementation
- Role-based access control (RBAC)
- Permission management
- Resource access policies
- User roles and assignments

## Installation Instructions

1. Extract the bundle:
   ```bash
   tar -xzf SQL_Files_Bundle.tar.gz
   ```

2. Create the database schema in order:
   ```bash
   psql -U your_user -d your_database -f 01_core.sql
   psql -U your_user -d your_database -f 02_counterparty_platform.sql
   psql -U your_user -d your_database -f 03_auth.sql
   psql -U your_user -d your_database -f 04_generic_acl.sql
   ```

## Execution Order Rationale

The files **must** be executed in the order above. `03_auth.sql` adds foreign-key constraints on tables (`tblAdminUser`, `tblInvestorAccount`, `tblAcknowledgmentUser`) that are created by `02_counterparty_platform.sql`. Running auth before counterparty_platform will fail with a "relation does not exist" error.

## Notes

- Do **not** execute scripts in plain alphabetical or arbitrary order — use the sequence above
- Ensure PostgreSQL is running before executing these scripts
- Adjust connection parameters (-U, -d) as needed for your environment
- Review each file for any configuration requirements specific to your deployment

## Total Bundle Size

- Compressed: ~51 KB
- Uncompressed: ~228 KB

---
Generated: 2026-05-24 | Fintech Platform MVP
