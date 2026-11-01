# Travel Together - Tak travel community

## Project and policy

Confirmed project: p01 (contest), folder D:\Travel, application port 31071, database db_std07_p01, database user std07. Node.js 24/CommonJS, entry server.js, static directory public. Application source is restricted to package.json, server.js, public/index.html, public/style.css and public/index.js, each under 1 MiB. Supporting Markdown documents are nonexecutable. Images are reserved for public/images/ and must satisfy platform sanitization requirements; no upload API exists in this release.

Policy revision 2, hash bef855c538ab3b91967a18c7dcc5cbb73a3cb55c7c0119187c17816d769529a7. Configuration uses process.env, with Node's native .env loading. .gitignore excludes .env, other local env variants and node_modules. No secret belongs in source, browser code, docs or Git. The previously embedded password was removed and is NOT reused. Credentials must be entered directly by the owner in the editor. No .env.example is needed.

## Features and data ownership

- Six editorial Tak destinations with district/category/text filtering and detail dialogs. These recommendations are not live opening-hour or weather data. CSS illustrations are labeled as simulated landscapes, not destination photographs.
- Register, log in, log out, and restore sessions using MariaDB. Display names and story content are visible to anyone who can access the private app route; email and password hashes are not exposed.
- Create destination-specific stories with integer ratings. Read newest-first, 12 per request, with keyset pagination and a destination filter. Only a story's authenticated owner may delete it. No editing or image upload is implemented.
- No fake community seed posts, no browser-only persistence and no fallback claiming database writes succeeded. Destination browsing still works without DB setup. Community and authentication show honest failure states.
- Accounts, hashed sessions and stories are persisted in tt_users, tt_sessions and tt_posts. See DATABASE.md for a proposed new migration suffix and the REQUIRED history inspection/import process. Server startup never creates or changes schema. The schema has not been imported by this agent.

## Validation contract

JSON mutation bodies are limited to 16 KiB. Non-object bodies and unexpected business fields are rejected. Text is trimmed and NFC-normalized; counts are Unicode code points. Control characters except normal tab/newline/carriage-return are rejected. Required fields do not accept null. Client HTML limits improve usability; server validation is authoritative.

- Display name: 2-60 code points; publicly displayed, not unique. Email: 3-190 ASCII characters, trimmed and lowercased, validated address structure, unique. No delivery verification is claimed.
- Password: 12-128 code points, at most 512 UTF-8 bytes, no trimming/normalization. Stored only as random 16-byte salt plus scrypt-derived 64-byte key (N=16384, r=8, p=1). Timing-safe key comparison, dummy work for unknown emails, at most three simultaneous hashes to bound memory.
- Story title: 4-120 code points. Body: 20-2000 code points. placeId must match the editorial catalog. rating must be a JSON integer 1-5; fractional/string/null values rejected. IDs are positive integers up to 2147483647. No URLs, filesystem paths, ownership IDs or database selectors are accepted from story input.
- Posts GET: optional before integer 1-2147483647 and place enum; unknown filter names are rejected. No date input or monetary units. DB timestamps use UTC; browser formats dates in Thai using the viewer timezone.
- Sessions: cryptographically random 32-byte opaque token; only its SHA-256 digest is stored, with 7-day UTC expiry. Cookie is HttpOnly, SameSite=Strict, Path=/ and Secure with __Host- prefix when APP_ORIGIN is HTTPS. The local HTTP development cookie is not suitable for unencrypted remote use. No auth token or password is stored in localStorage.

## API

- GET /api/places -> { places }, editorial public-to-app catalog, no DB needed.
- GET /api/health -> 200 { status: ok, database: connected } only after connection and required-table checks; otherwise 503 { status: unavailable, database: unavailable }. No query/body/content-type accepted; non-GET is 405.
- POST /api/auth/register { name, email, password } -> 201 { user: { id, name } } and session cookie. Duplicate email -> 409. Account insertion may succeed before a failed session creation; in that case retry login rather than registration.
- POST /api/auth/login { email, password } -> 200 { user }, new session cookie. Incorrect credentials -> 401.
- GET /api/auth/me -> { user: { id, name } }; missing/expired session -> 401.
- POST /api/auth/logout {} -> { ok: true }; deletes current session and clears cookie. Other sessions are not revoked.
- GET /api/posts?place=<id>&before=<id> -> { posts, next }; next is a keyset cursor or null. Each post has id, userId, author, placeId, title, body, rating, createdAt. No private account fields.
- POST /api/posts { placeId, title, body, rating } -> 201 { id }; authentication required.
- DELETE /api/posts/:id with JSON content-type/body {} -> { ok: true }; authenticated ownership in the SQL WHERE clause; unknown/not-owned -> 404.
- Unknown API -> JSON 404. Malformed JSON -> 400; oversized body -> 413; invalid input -> 400; bad mutation origin/content-type -> 403; rate limit -> 429; DB/setup/service failure -> safe 503.

## Security and deployment

All SQL business values are parameterized. Browser output uses textContent/DOM construction, not user-generated HTML. API responses are no-store. CSP forbids inline/third-party scripts, objects, framing and cross-origin connections. The API enables no CORS. Every mutation requires an exact configured APP_ORIGIN and application/json, preventing simple cross-site forms; keep this origin fixed and correct at deployment. Do not use user-controlled Host/forwarding headers as authority.

Process-local IP buckets allow 30 authentication requests or 60 other mutations per 15 minutes, bounded to 2000 buckets. Reverse proxy and distributed limits require platform configuration; trust proxy is not enabled. Sessions are unbounded per user within rate limits; expired rows are removed on successful authentication. Anonymous reads need platform-level request limits. The three DB connections, 16 KiB body limit and hashing semaphore reduce resource use but do not replace platform memory/load testing.

Before deployment: verify the database host from the platform, enter the project password locally, inspect migration history and import only through the DB UI, set exact private APP_ORIGIN, require HTTPS outside localhost, recheck backend, and run current Semgrep, OSV and Gitleaks scans (high severity blocks; results at most 24 hours old). npm audit is supplemental, not a substitute. Do not claim these platform scans passed unless actually run.

Deploy only allowed application files plus permitted nonexecutable documents; provide managed .env separately. node_modules and the locally generated package-lock.json are not application upload files under the room's explicit source allowlist. Install dependencies with lifecycle scripts disabled. Filesystem must be controlled by the platform, without symlinks escaping the project. Public publication is disabled in this room. Non-root execution, 192 MiB limits, account/project isolation, routing and 365-day deletion INCLUDING backups must be verified on the platform. App read filtering of old posts is not physical retention deletion; see DATABASE.md.

## Verification status

Local checks completed on 2026-11-01:

- node --check passed for server.js and public/index.js; editor diagnostics found no errors in backend, HTML, CSS or browser JavaScript.
- npm audit --omit=dev --ignore-scripts reported zero known vulnerabilities. This does not replace the required platform scans.
- Initial smoke checks passed: 26 HTTP checks and 8 browser checks, covering unconfigured-DB behavior, input errors, origin checks, protected source paths, search/category/detail/auth dialogs and mobile overflow.
- After fixes, 11 additional HTTP checks passed, including HEAD/POST/DELETE/PUT/OPTIONS health requests returning 405 with Allow: GET. Browser checks confirmed the corrected Mueang Tak district option selects only Lan Sang, resetting restores six destinations, and the mobile page has no horizontal overflow.
- Each of the five allowed application files is below 1 MiB (largest: server.js, 18247 bytes at verification).

These checks used the local app with database not configured. Earlier starter health success does not validate the new schema or business features. Real registration, login, session persistence, story writes and ownership tests remain blocked until the owner configures a password and imports an approved schema through the database UI. No migration, account creation or remote DB write has been performed by this agent. Required Semgrep, OSV and Gitleaks scans, runtime memory/isolation checks and platform retention verification remain pending; deployment readiness is not claimed. Password recovery, moderation and email verification remain out of scope.

