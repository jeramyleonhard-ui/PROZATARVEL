# Travel Together: database setup (p01 only)

Confirmed project: p01. Database: db_std07_p01. Database user: std07. MariaDB port: 3306. The existing assigned LAN host is configured in local .env; verify that host with the platform connection information before deployment. Never use credentials from legacy or a root account.

## Required manual steps

1. In the platform, select p01 and verify its current database is db_std07_p01 with user std07.
2. Download the CURRENT migrations.sql and inspect the applied history in the database UI. This workspace has no verified migration history. The SQL below is a PROPOSED NEW suffix, not a replacement for accepted migrations. Do not import blindly.
3. Check that tt_users, tt_sessions and tt_posts do not already exist. If they exist, stop and compare the existing schema/history before preparing a compatible appended migration. Do not drop, reset, truncate or rename existing data. Back up through the platform first.
4. If these are new tables, append this proposed block to the downloaded original migrations.sql, preserving every byte of the existing accepted prefix. Upload it through the DATABASE UI ONLY. Do not add migrations.sql to application source and do not run SQL from npm, Git or server.js. No CREATE DATABASE or GRANT is required.
5. Enter ONLY the p01 project's password into DB_PASSWORD in your LOCAL .env using the editor. Never paste passwords into chat, public files, screenshots, documentation or Git. If the previous hardcoded password was ever shared/committed, rotate it through the platform.
6. APP_ORIGIN must exactly match the URL used to open the application, including scheme and port. The local default is http://localhost:31071. For LAN/Tailscale or a private platform route, configure its actual origin. Use HTTPS for nonlocal access so the session cookie is Secure. Restart after configuration changes.
7. Start with npm start. GET /api/health returns 200 only when connectivity and the three required tables are available. Verify register, logout, login, creating a story, reloading and ownership-protected deletion after setup.

## Proposed new migration suffix

This creates only three project-specific community tables. DDL may auto-commit in MariaDB: if an import partly fails, use the platform's applied history and schema inspection to prepare the next append; never pretend a partial application was rolled back. All application timestamps are UTC; browser presentation uses Thai formatting.

```sql
CREATE TABLE tt_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(60) NOT NULL,
  email VARCHAR(190) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  password_hash CHAR(161) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY tt_users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tt_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY tt_sessions_expiry (expires_at),
  KEY tt_sessions_user (user_id),
  CONSTRAINT tt_sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES tt_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tt_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  place_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY tt_posts_place_id (place_id, id),
  KEY tt_posts_created (created_at),
  KEY tt_posts_user (user_id),
  CONSTRAINT tt_posts_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT tt_posts_user_fk FOREIGN KEY (user_id)
    REFERENCES tt_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Important operational limits

- This agent has NOT imported the schema, accessed a password or verified real database writes.
- This is one project's standalone database, not a multi-tenant platform. Platform authentication, ownership isolation, non-root execution, filesystem/symlink isolation, private routing and 192 MiB resource enforcement must be provided and verified by the classroom platform.
- No photo uploads are implemented. public/images/ is reserved for platform-sanitized image assets only.
- Session expiry is seven days; expired rows are removed on successful authentication. Auth/write limits are process-local and restart with the app. Shared reverse proxies require correctly configured platform limits; do not blindly enable trust proxy.
- Posts older than 365 days are excluded from reads, but exclusion is NOT physical deletion. Platform retention must purge accounts, posts, sessions, logs and all backups no later than 365 days from creation. Verify that platform lifecycle before deploying; the application does not execute schema migrations or automated destructive maintenance.
- Password recovery, email verification, moderation/reporting and account self-service deletion are not implemented. Arrange administrator handling through the platform before wider use.
- Public publication is DISABLED for this room. Posting a story inside the app does not publish a platform public route.
