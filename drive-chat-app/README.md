# Drive Knowledge Base Chat

A Flask web app that lets authorized users chat with an AI assistant (Claude) that has read the contents of two Google Drive folders. Access is controlled via a Google Sheets allowlist and Google OAuth 2.0.

---

## Prerequisites

- Python 3.11+
- A Google Cloud project
- An Anthropic API key

---

## Setup Steps

### 1. Create a Google Cloud project and enable APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or select an existing one).
2. Navigate to **APIs & Services > Library** and enable:
   - **Google Drive API**
   - **Google Sheets API**
   - **Google People API** (for OAuth user info)

### 2. Create OAuth 2.0 credentials (for user login)

1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Set **Application type** to **Web application**.
3. Add an **Authorized redirect URI**: `http://localhost:5000/oauth2callback`
4. Download or copy the **Client ID** and **Client Secret** — you'll need these in `.env`.
5. If prompted, configure the **OAuth consent screen** with your app name and add your email as a test user.

### 3. Create a service account (for Drive/Sheets access)

1. Go to **APIs & Services > Credentials > Create Credentials > Service account**.
2. Give it a name (e.g., `drive-reader`), click **Done**.
3. Click the service account, go to **Keys > Add Key > Create new key > JSON**.
4. Download the JSON file and place it in the project directory (e.g., `service_account.json`).
5. Note the service account's email address (looks like `name@project.iam.gserviceaccount.com`).

### 4. Share Drive folders with the service account

For each of the two Google Drive folders (`0AAgHqsxVlMegUk9PVA` and `18k12A-Sm3DcluJ3OXl1o0Z-GmvWsOnnL`):

1. Open the folder in Google Drive.
2. Click **Share**.
3. Add the service account email as a **Viewer**.

### 5. Create the allowlist Google Sheet

1. Create a new Google Sheet.
2. In column A, list the email addresses that should have access (one per row, starting from row 1 — no header needed, or a header is fine since it won't match any real email).
3. Share the sheet with the service account email as a **Viewer**.
4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### 6. Configure the .env file

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Where to find it |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client credentials |
| `GOOGLE_CLIENT_SECRET` | OAuth client credentials |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/oauth2callback` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Path to your downloaded JSON key file |
| `ALLOWLIST_SHEET_ID` | From the Sheet URL |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `FLASK_SECRET_KEY` | Run: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DRIVE_FOLDER_IDS` | Pre-filled: `0AAgHqsxVlMegUk9PVA,18k12A-Sm3DcluJ3OXl1o0Z-GmvWsOnnL` |

### 7. Install dependencies and run

```bash
cd drive-chat-app
pip install -r requirements.txt
python app.py
```

Open your browser at [http://localhost:5000](http://localhost:5000).

On startup the app will print a banner like:

```
============================================================
  Drive Knowledge Base loaded
  Documents: 14
  Total characters: 248,391
============================================================
```

---

## Routes

| Route | Description |
|---|---|
| `GET /` | Chat UI (requires login) |
| `GET /login` | Login page |
| `GET /auth/google` | Starts Google OAuth flow |
| `GET /oauth2callback` | OAuth callback |
| `GET /logout` | Clears session |
| `POST /chat` | Send message, get reply |
| `GET /documents` | JSON list of loaded documents |
| `GET /reload-drive` | Re-index Drive folders (requires login) |
| `GET /health` | Health check, returns doc count |

---

## Architecture notes

- Drive content is loaded **once at startup** and held in memory.
- The system prompt (containing all document text) is built once and reused for every chat request.
- If total content exceeds ~180k tokens (~720k characters), documents are truncated with a warning in the logs.
- Individual file load failures are caught and logged — they do not crash the app.
- User sessions are stored server-side in Flask's signed cookie session.
- The service account has read-only Drive scope (`drive.readonly`) and read-only Sheets scope (`spreadsheets.readonly`).

---

## Security notes

- Never commit your `.env` file or `service_account.json` to version control. Add them to `.gitignore`.
- Use a strong random value for `FLASK_SECRET_KEY`.
- For production, run behind a reverse proxy (nginx) with HTTPS and update `GOOGLE_REDIRECT_URI` accordingly.
