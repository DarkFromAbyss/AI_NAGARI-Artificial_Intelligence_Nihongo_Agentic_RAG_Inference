# AI NARAGI Database Dictionary

## Table: `users`

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PRIMARY KEY | Unique user identifier |
| username | TEXT | NOT NULL, UNIQUE | User login identifier |
| email | TEXT | NOT NULL, UNIQUE | User email for communications |
| full_name | TEXT | NULL | User's display name |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | Soft-delete flag; supports user suspension |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last profile modification time |

**Business Role:** Foundation entity for user management. Enables multi-user support, access control, and user lifecycle tracking. Designed for future expansion (roles, preferences, profile fields).

---

## Table: `user_credentials`

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PRIMARY KEY | Credential record identifier |
| user_id | INTEGER | NOT NULL, UNIQUE, FK | Reference to users table |
| password_hash | TEXT | NOT NULL | Bcrypt/Argon2 hashed password (never store plaintext) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Password creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last password change time |

**Business Role:** Separates authentication from user profile data for security. Enables password history tracking and multi-credential support (future: OAuth, SAML). UNIQUE constraint on user_id ensures 1:1 relationship.

---

## Table: `sessions`

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PRIMARY KEY | Session record identifier |
| user_id | INTEGER | NOT NULL, FK | Reference to users table |
| session_token | TEXT | NOT NULL, UNIQUE | Secure session identifier (JWT or random hash) |
| ip_address | TEXT | NULL | Client IP for audit trail |
| user_agent | TEXT | NULL | Client browser/device info for audit trail |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | Tracks logout/session revocation |
| expires_at | TIMESTAMP | NOT NULL | Session expiration time |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Session start time |

**Business Role:** Manages user authentication state. Supports multi-session per user (concurrent logins), audit logging, and security monitoring. Enables session invalidation and device tracking for future features.

---

## Table: `activity_log`

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | INTEGER | PRIMARY KEY | Log entry identifier |
| user_id | INTEGER | NULL, FK | Reference to users table; NULL for system actions |
| action_type | TEXT | NOT NULL | Type of action (e.g., LOGIN, QUERY, EXPORT) |
| resource_type | TEXT | NULL | Entity type affected (e.g., DOCUMENT, REPORT) |
| resource_id | INTEGER | NULL | Entity identifier affected |
| details | TEXT | NULL | JSON or structured data for context |
| ip_address | TEXT | NULL | Request origin for security audits |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When action occurred |

**Business Role:** Immutable audit trail for compliance, debugging, and security analysis. Tracks all user interactions. Supports future features: usage analytics, anomaly detection, GDPR data export. Designed for high-volume writes with efficient querying by user and date range.

---

## Design Principles

- **Normalization:** Credentials separated from user profiles; sessions independent from profiles to support concurrent logins.
- **Soft Deletes:** `users.is_active` enables data retention without cascade deletion.
- **Audit Trail:** Timestamps on all tables; activity_log provides full transaction history.
- **Scalability:** Indexed columns (email, username, user_id, timestamps) optimize query performance for millions of records.
- **Security:** Credentials stored hashed; sessions use unique tokens; activity_log captures IP/user_agent for forensics.