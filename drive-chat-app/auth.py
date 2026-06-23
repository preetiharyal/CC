import os
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.oauth2 import service_account
import requests

SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]


def _get_client_config():
    return {
        "web": {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uris": [os.environ["GOOGLE_REDIRECT_URI"]],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def get_auth_url():
    flow = Flow.from_client_config(
        _get_client_config(),
        scopes=SCOPES,
        redirect_uri=os.environ["GOOGLE_REDIRECT_URI"],
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="select_account",
    )
    return auth_url, state


def exchange_code(code, state):
    flow = Flow.from_client_config(
        _get_client_config(),
        scopes=SCOPES,
        state=state,
        redirect_uri=os.environ["GOOGLE_REDIRECT_URI"],
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials
    userinfo_response = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {credentials.token}"},
    )
    userinfo_response.raise_for_status()
    return userinfo_response.json().get("email")


def _get_service_account_credentials(scopes):
    json_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not json_path or not os.path.exists(json_path):
        raise FileNotFoundError(
            f"Service account JSON not found at: {json_path}"
        )
    return service_account.Credentials.from_service_account_file(json_path, scopes=scopes)


def is_user_allowed(email: str, sheet_id: str) -> bool:
    try:
        creds = _get_service_account_credentials(
            ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        )
        service = build("sheets", "v4", credentials=creds)
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=sheet_id, range="A:A")
            .execute()
        )
        rows = result.get("values", [])
        allowed_emails = {row[0].strip().lower() for row in rows if row}
        return email.strip().lower() in allowed_emails
    except Exception as e:
        print(f"[auth] Error checking allowlist: {e}")
        return False
