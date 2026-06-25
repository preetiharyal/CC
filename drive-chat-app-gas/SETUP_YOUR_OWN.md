# MST Squad Knowledge Base — Deploy Your Own Copy

If you're getting a "You do not have permission" error, follow these steps to deploy your own copy of the app under your own Google account. It takes about 10 minutes.

---

## What you need
- Your Telus Google account (`@telus.com`)
- Access to [script.google.com](https://script.google.com)
- The Fuelix API key (ask your team lead)
- The folder IDs to index (ask your team lead)

---

## Step 1 — Create a new Apps Script project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Rename it to **MST Squad Knowledge Base** (click "Untitled project" top-left)

---

## Step 2 — Add the files

You need 4 files total. For each one, copy the content exactly as provided.

### Code.gs (already exists by default)
- Click `Code.gs` in the left panel
- Select all existing content and delete it
- Paste the contents of `Code.gs` from this repo

### index.html
- Click the **+** button next to "Files"
- Choose **HTML**
- Name it `index` (editor adds `.html` automatically)
- Paste the contents of `index.html`

### login.html
- Click **+** → **HTML** → name it `login`
- Paste the contents of `login.html`

### appsscript.json
- Click the **gear icon** (Project Settings) in the left sidebar
- Check **"Show appsscript.json manifest file in editor"**
- Go back to the editor and click `appsscript.json`
- Delete all existing content and paste the contents of `appsscript.json`

---

## Step 3 — Enable the Advanced Drive Service

1. In the left sidebar, click **+** next to "Services"
2. Find **Google Drive API** in the list
3. Click **Add**

> This is required for reading shared drives. If you skip this step, documents won't load.

---

## Step 4 — Add Script Properties

Script Properties are where you store your API keys and folder IDs securely.

1. Click the **gear icon** (Project Settings)
2. Scroll down to **Script properties**
3. Click **Add script property** and add the following:

| Property | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Fuelix API token |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` |
| `FOLDER_IDS` | Comma-separated folder IDs (get from team lead) |
| `ALLOWLIST_SHEET_ID` | *(optional)* Google Sheet ID with allowed emails in column A |

---

## Step 5 — Deploy as a Web App

1. Click **Deploy** (top right) → **New deployment**
2. Click the **gear icon** next to "Select type" → choose **Web app**
3. Set the following:
   - **Description:** MST Squad Knowledge Base
   - **Execute as:** Me (your Telus email)
   - **Who has access:** Anyone at Telus *(or "Anyone with a Google Account" if that option isn't available)*
4. Click **Deploy**
5. Google will ask for permissions — click through and **Allow** all prompts (Drive, Docs, Sheets, Slides access)
6. Copy the **Web App URL** — this is your personal link to the app

---

## Step 6 — Test it

Open your Web App URL in a browser. You should see:
- The **MST Squad Knowledge Base** header in purple
- A sidebar loading your documents
- A chat input at the bottom

Type a question and hit Enter. If you get a response, everything is working.

---

## Troubleshooting

**"You do not have permission to access the requested document"**
- Make sure you're signed into Chrome with your `@telus.com` account
- Try opening the URL in an Incognito window and signing in fresh

**"No documents found"**
- Double-check `FOLDER_IDS` in Script Properties — should be comma-separated IDs with no spaces around the comma
- Make sure you have at least Viewer access to the Drive folders
- Click **Reload Documents** in the sidebar

**"Invalid or missing API key" / Fuelix 401 error**
- Check `ANTHROPIC_API_KEY` in Script Properties — paste the key again carefully
- Make sure there are no spaces before or after the key value

**Documents load but chat gives wrong answers**
- The AI only knows what's in the loaded documents
- Check the sidebar to confirm your expected files are listed
- Click **Reload Documents** to refresh if you recently added files

---

## Updating the app later

If the team shares an updated version of any file:
1. Paste the new content into the relevant file in your editor
2. Go to **Deploy → Manage deployments → Edit → New version → Deploy**
3. Use the same Web App URL — it updates automatically

---

## Need help?

Contact your team lead or the person who set up the original app.
