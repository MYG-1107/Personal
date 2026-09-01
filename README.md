# Personal File Vault

A simple full-stack file storage and sharing website for learning how frontend and backend systems communicate.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** SQLite (stores metadata only)
- **File Storage:** Local filesystem (`/uploads`)
- **Auth:** Session-based owner login + bcrypt password hash validation

---

## Project Structure

```text
Personal/
├── backend/
│   ├── data/files.db
│   ├── database.js
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── files.js
│   │   └── share.js
│   ├── middleware/
│   │   └── auth.js
│   └── services/
│       ├── authService.js
│       └── fileService.js
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── script.js
│   └── style.css
├── uploads/
│   ├── documents/
│   ├── images/
│   ├── others/
│   ├── pdfs/
│   └── text/
├── .env.example
├── package.json
└── README.md
```

---

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and configure secrets:

```bash
cp .env.example .env
```

3. Generate an admin password hash (replace `YOUR_PASSWORD`):

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD',10).then(h=>console.log(h))"
```

4. Put the generated value into `.env` as `ADMIN_PASSWORD_HASH`.

5. Start the app:

```bash
npm start
```

6. Open:

- Dashboard: `http://localhost:3000/`
- Login page: `http://localhost:3000/login`

---

## API Endpoints

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Files (owner-only)

- `POST /api/files/upload` (multipart, field name: `files`)
- `GET /api/files?search=<text>&category=<all|images|pdfs|documents|text|others>`
- `GET /api/files/:id`
- `GET /api/files/:id/view`
- `GET /api/files/:id/download`
- `DELETE /api/files/:id`
- `POST /api/files/:id/share`
- `POST /api/files/:id/share/revoke`

### Share Link (public for a single file)

- `GET /share/:token`

---

## Learning Explanations (Major Parts)

## 1) `frontend/index.html`

### What this file does
Builds the dashboard UI: upload form, search box, category filters, and file list table with View/Download/Share/Delete actions.

### Why it exists
It is the visible interface where user actions begin.

### Frontend ↔ Backend communication
JavaScript in `frontend/script.js` uses `fetch()`/`XMLHttpRequest` to call backend endpoints.

### Example request and response
- Request: `GET /api/files?search=resume&category=documents`
- Response:

```json
{
  "files": [
    {
      "id": 4,
      "original_filename": "Resume.docx",
      "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "file_size": 48312,
      "category": "documents",
      "uploaded_at": "2026-09-01 05:00:00",
      "can_view_in_browser": false,
      "share_url": null
    }
  ]
}
```

### Mock data for learning
`script.js` includes `mockFiles` and a `USE_MOCK_DATA` flag. You can set it to `true` to study frontend behavior before API calls.

---

## 2) `frontend/script.js`

### What this file does
Handles:
- Loading files
- Upload with progress
- Search/filter updates
- Action buttons (view/download/share/delete)

### Why it exists
Keeps backend-free HTML and puts browser logic into JS.

### Communication details
- Upload uses `POST /api/files/upload` with `FormData`
- Search/filter uses `GET /api/files?...`
- Delete uses `DELETE /api/files/:id`
- Share uses `POST /api/files/:id/share`

---

## 3) `frontend/login.html`

### What this file does
Provides owner login form (username + password).

### Why it exists
Only authenticated owner can manage private file library.

### Communication details
Sends:

```http
POST /api/auth/login
Content-Type: application/json
```

Body:

```json
{ "username": "admin", "password": "..." }
```

Response example:

```json
{ "message": "Login successful.", "username": "admin" }
```

---

## 4) `backend/server.js`

### What this file does
Starts Express app, configures middleware, mounts routes, serves frontend, and initializes database.

### Why it exists
It is the backend entry point and wiring location.

### Security-related behavior
- Uses `helmet`
- Uses session cookies (`httpOnly`, `sameSite=lax`)
- Returns safe error messages
- Does **not** expose `/uploads` as a static directory

---

## 5) `backend/database.js`

### What this file does
Creates/opens SQLite DB and initializes required tables.

### Why it exists
Separates persistence logic from route logic.

### Where metadata is stored
SQLite table `files`:
- `id`
- `original_filename`
- `stored_filename`
- `file_path`
- `mime_type`
- `file_size`
- `category`
- `uploaded_at`
- `share_token`

### Where actual file bytes are stored
Filesystem under `/uploads/<category>/...`

---

## 6) `backend/routes/files.js`

### What this file does
Implements file upload, list, metadata fetch, view, download, delete, share-link generation, and share-link revoke.

### Why it exists
Groups file-management API behavior.

### Upload flow (request → storage)
```text
Browser
  ↓ FormData (files)
POST /api/files/upload
  ↓ multer validates type + size
Server generates unique stored filename
  ↓
File saved to uploads/<category>/
  ↓
Metadata saved to SQLite
  ↓
JSON response returned to frontend
```

### Download flow
```text
Browser
  ↓
GET /api/files/:id/download
  ↓ auth check
SQLite lookup by id
  ↓
Server reads file path and streams download
```

### Search/filter flow
```text
GET /api/files?search=notes&category=text
```
Backend builds SQL `WHERE` clause and returns matching rows.

---

## 7) `backend/routes/auth.js` + `backend/middleware/auth.js`

### What these files do
- `auth.js`: login/logout/session-status endpoints
- `auth.js` middleware: blocks unauthenticated users from private APIs

### Why they exist
To enforce owner-only access for private library actions.

### How authentication works
1. Owner submits username/password.
2. Backend compares username and bcrypt hash (`ADMIN_PASSWORD_HASH` from `.env`).
3. If valid, session is created (`req.session.userId = 'owner'`).
4. Protected routes check session with `requireAuth` middleware.

### Permission checks
Protected actions (upload/delete/list/share) require valid session.

---

## 8) `backend/routes/share.js`

### What this file does
Serves a single file by unguessable share token (`/share/:token`).

### Why it exists
Allows selective sharing of one file without revealing full private library.

### How share URLs work
1. Owner calls `POST /api/files/:id/share`.
2. Backend creates random token and stores it in `files.share_token`.
3. URL format: `/share/<token>`.
4. Anyone with token can access **only that file**.
5. No upload path or DB internals are exposed.

---

## Security: Implemented vs Simplified

### Implemented
- Owner authentication (session-based)
- Password hash check with bcrypt
- Login rate limiting
- File size limit
- Allowed-extension validation
- Unique internal filename generation
- No direct static `/uploads` exposure
- Basic unauthorized/404/user-safe error messages

### Simplified for learning
- Single owner account configured from `.env`
- Permanent share links (no expiration by default)
- Session store is in-memory (good for local learning, not production)

---

## Future Improvements

### Share-link controls
You can add:
- Expiration timestamps
- Password-protected links
- Download counters and limits
- One-time links
- Manual revoke dashboard UI

### Cloud storage migration (same architecture)
Replace filesystem write/read in file routes with storage service calls:
- Amazon S3
- Cloudflare R2
- Google Cloud Storage
- Azure Blob Storage

Keep SQLite metadata model, but replace `file_path` with bucket key/object key.

---

## Incremental Learning Phases

1. **Phase 1:** Frontend (`index.html`, `style.css`, `script.js`) with mock data toggle
2. **Phase 2:** Express backend scaffolding (`server.js`, route files)
3. **Phase 3:** SQLite metadata (`database.js`)
4. **Phase 4:** Frontend connected to APIs (`fetch` calls)
5. **Phase 5:** Upload + validation + file save
6. **Phase 6:** View/download endpoints
7. **Phase 7:** Owner auth/login + protected routes
8. **Phase 8:** Share links by random token
9. **Phase 9:** Security hardening basics (helmet, rate limit, safe errors)

---

## Manual Testing Checklist

1. Login at `/login`.
2. Upload multiple allowed file types.
3. Search by file name.
4. Filter by category.
5. View image/pdf/text in browser.
6. Download doc/zip and other binary files.
7. Generate a share URL and open it in a private browser window.
8. Revoke share link and verify URL no longer works.
9. Logout and verify private APIs return unauthorized.
