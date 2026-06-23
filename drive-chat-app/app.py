import os
import logging
from functools import wraps
from flask import Flask, session, redirect, request, jsonify, render_template, url_for
from dotenv import load_dotenv

load_dotenv()

from auth import get_auth_url, exchange_code, is_user_allowed
from drive_reader import DriveReader
from chat_handler import ChatHandler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ["FLASK_SECRET_KEY"]

drive_content: list = []
chat_handler: ChatHandler | None = None


def load_drive_content():
    global drive_content, chat_handler
    folder_ids_raw = os.environ.get("DRIVE_FOLDER_IDS", "")
    folder_ids = [fid.strip() for fid in folder_ids_raw.split(",") if fid.strip()]

    if not folder_ids:
        logger.warning("No DRIVE_FOLDER_IDS configured. Drive content will be empty.")
        drive_content = []
        chat_handler = ChatHandler(drive_content)
        return

    reader = DriveReader(folder_ids)
    try:
        drive_content = reader.load_all_content()
    except Exception as e:
        logger.error(f"Failed to load Drive content: {e}")
        drive_content = []

    chat_handler = ChatHandler(drive_content)
    chat_handler.build_system_prompt()

    total_chars = sum(len(d["content"]) for d in drive_content)
    print("\n" + "=" * 60)
    print(f"  Drive Knowledge Base loaded")
    print(f"  Documents: {len(drive_content)}")
    print(f"  Total characters: {total_chars:,}")
    print("=" * 60 + "\n")


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "email" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.route("/")
@login_required
def index():
    return render_template("chat.html", email=session["email"])


@app.route("/login")
def login():
    if "email" in session:
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/auth/google")
def auth_google():
    auth_url, state = get_auth_url()
    session["oauth_state"] = state
    return redirect(auth_url)


@app.route("/oauth2callback")
def oauth2callback():
    error = request.args.get("error")
    if error:
        logger.warning(f"OAuth error: {error}")
        return render_template("login.html", error="Authentication was cancelled or failed."), 400

    code = request.args.get("code")
    state = request.args.get("state")

    if not code:
        return render_template("login.html", error="No authorization code received."), 400

    if state != session.get("oauth_state"):
        return render_template("login.html", error="Invalid OAuth state. Please try again."), 400

    try:
        email = exchange_code(code, state)
    except Exception as e:
        logger.error(f"Token exchange failed: {e}")
        return render_template("login.html", error="Authentication failed. Please try again."), 500

    if not email:
        return render_template("login.html", error="Could not retrieve your email address."), 400

    sheet_id = os.environ.get("ALLOWLIST_SHEET_ID", "")
    if sheet_id and not is_user_allowed(email, sheet_id):
        logger.info(f"Access denied for {email}")
        return render_template("login.html", error="Your account is not authorized to access this application."), 403

    session["email"] = email
    session.pop("oauth_state", None)
    logger.info(f"User logged in: {email}")
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    email = session.pop("email", None)
    if email:
        logger.info(f"User logged out: {email}")
    return redirect(url_for("login"))


@app.route("/chat", methods=["POST"])
@login_required
def chat():
    if chat_handler is None:
        return jsonify({"error": "Chat handler not initialized."}), 503

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body."}), 400

    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if not isinstance(history, list):
        return jsonify({"error": "History must be a list."}), 400

    try:
        reply = chat_handler.chat(message, history)
        return jsonify({"reply": reply})
    except Exception as e:
        logger.error(f"Chat error for {session.get('email')}: {e}")
        return jsonify({"error": "Failed to get a response. Please try again."}), 500


@app.route("/documents")
@login_required
def documents():
    doc_list = [
        {"filename": d["filename"], "size": len(d["content"])}
        for d in drive_content
    ]
    return jsonify(doc_list)


@app.route("/reload-drive")
@login_required
def reload_drive():
    load_drive_content()
    return jsonify({"status": "ok", "docs_loaded": len(drive_content)})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "docs_loaded": len(drive_content)})


if __name__ == "__main__":
    load_drive_content()
    app.run(debug=False, host="0.0.0.0", port=5000)
