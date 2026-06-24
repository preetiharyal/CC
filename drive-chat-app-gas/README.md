# Drive Knowledge Base — Google Apps Script Setup

A chat app that lets employees ask questions about files in Google Drive folders, powered by Claude (Anthropic). Runs entirely on Google's servers via Apps Script — no GCP Console, no API credentials setup, no servers to manage.

## Prerequisites

- A Google account with access to the Drive folders you want to index
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)
- The Drive folder IDs you want to index (see Note below on finding them)

> **Finding a folder ID:** Open the folder in Google Drive. The URL looks like
> `https://drive.google.com/drive/folders/0AAgHqsxVlMegUk9PVA`. The long string after `/folders/` is the ID.

---

## Setup Steps

### Step 1 — Create the Apps Script project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Name it **Drive Knowledge Base** (top-left, click "Untitled project")

### Step 2 — Add the files

In the Apps Script editor left panel you will see a default `Code.gs` file.

**Add Code.gs:**
- Click on `Code.gs` in the left panel, select all existing content and replace it with the contents of `Code.gs` from this repo.

**Add index.html:**
- Click the **+** button next to "Files" in the left panel
- Choose **HTML**
- Name it `index` (the editor appends `.html` automatically)
- Replace all content with the contents of `index.html` from this repo

**Add login.html:**
- Click **+** again, choose **HTML**, name it `login`
- Replace all content with the contents of `login.html` from this repo

**Update appsscript.json:**
- Click the gear icon (Project Settings) in the left sidebar
- Check **"Show 'appsscript.json' manifest file in editor"**
- Go back to the editor, click `appsscript.json`
- Replace all content with the contents of `appsscript.json` from this repo

### Step 3 — Configure Script Properties

Script Properties are the secure way to store secrets in Apps Script (like environment variables).

1. In the left sidebar, click the **gear icon** (Project Settings)
2. Scroll down to **Script properties**
3. Click **Add script property** for each of the following:

| Property | Value | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com | Yes |
| `FOLDER_IDS` | Comma-separated folder IDs, e.g. `id1,id2,id3` | Yes |
| `ALLOWLIST_SHEET_ID` | Google Sheet ID for access control (see Step 4) | No — if omitted, all Google users can access |

> **Adding or removing folders later:** Just edit the `FOLDER_IDS` property value and click the Reload button in the sidebar. No code changes or redeployment needed.

4. Click **Save script properties**

### Step 4 — Create the allowlist sheet (optional but recommended)

If you want to restrict access to specific employees:

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. In **column A**, list the email addresses of allowed users — one per row, no header row needed:
   ```
   alice@company.com
   bob@company.com
   carol@company.com
   ```
3. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`):
   `https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`
4. Add it as `ALLOWLIST_SHEET_ID` in Script Properties (Step 3)

To add or remove users later, just edit the spreadsheet — no redeployment needed.

### Step 5 — Deploy as Web App

1. In the Apps Script editor, click **Deploy** (top right) > **New deployment**
2. Click the gear icon next to "Type" and select **Web app**
3. Fill in the settings:
   - **Description:** Drive Knowledge Base v1
   - **Execute as:** User accessing the web app
   - **Who has access:** Anyone with a Google Account *(or choose "Anyone in [your domain]" for extra restriction)*
4. Click **Deploy**
5. Copy the **Web app URL** — this is the URL you share with your team

### Step 6 — Grant permissions

The first time the app runs (or when you first deploy), Google will ask for permissions:

1. A dialog appears: "Drive Knowledge Base wants to access your Google Account"
2. Click **Review permissions**
3. Sign in if prompted
4. You may see a "Google hasn't verified this app" warning — click **Advanced** then **Go to Drive Knowledge Base (unsafe)**
   - This is normal for internal Apps Script projects; Google shows this for any unverified OAuth app
5. Grant all requested permissions (Drive, Sheets, Docs, Slides access)

Each user who accesses the app will go through this once.

### Step 7 — Share the URL

Send the Web App URL to your team members. They:
1. Click the link
2. Sign in with their Google account (if not already signed in)
3. Grant permissions on first visit
4. Start chatting immediately

---

## Managing the app

### Adding or removing users
- Edit the allowlist Google Sheet directly
- Changes take effect immediately — no redeployment needed

### Refreshing documents
- Documents are cached for 6 hours to avoid slow load times
- To force a refresh: click **Reload Documents** in the sidebar
- Or open the Apps Script editor, select `reloadCache` from the function dropdown, and click Run

### Redeploying after code changes
- After editing any `.gs` or `.html` file: **Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy**
- The URL stays the same

### Viewing logs
- In the Apps Script editor: **View > Logs** (or Ctrl+Enter)
- Skipped files (PDFs, Office files) are logged here

---

## Supported file types

| Type | Supported | Notes |
|---|---|---|
| Google Docs | Yes | Full text extracted |
| Google Sheets | Yes | All sheets, tab-separated values |
| Google Slides | Yes | Text from all shapes on all slides |
| Google Forms | No | Skipped |
| PDFs | No | Apps Script cannot parse binary PDFs natively |
| Uploaded .docx / .pptx / .xlsx | No | Binary Office formats not parseable in GAS |

**Tip:** If you have PDFs with important content, open them in Google Drive and use **Open with > Google Docs** to convert them — the converted Doc will then be indexed.

---

## Troubleshooting

**"ANTHROPIC_API_KEY not configured"**
- Go to Project Settings > Script properties and add the key

**"Error loading documents"**
- Check that FOLDER_IDS is correct in Script Properties
- Make sure the logged-in user has access to those Drive folders
- Check the Apps Script logs (View > Logs) for details

**"Access Denied" page for a user who should have access**
- Check that their exact email (case-insensitive) is in the allowlist sheet column A
- Make sure ALLOWLIST_SHEET_ID points to the right sheet

**Slow loading**
- The first load after cache expiry (6 hours) will be slow for large document sets
- Consider removing very large files from the indexed folders

**"Google hasn't verified this app" on login**
- This is expected for internal Apps Script projects
- Click Advanced > Go to [app name] (unsafe) — it is safe for internal use
- To remove this warning, you would need to submit the app for Google verification (not necessary for internal tools)
