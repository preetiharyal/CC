import os
import logging
import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_SYSTEM_CHARS = 720000  # ~180k tokens at ~4 chars/token


class ChatHandler:
    def __init__(self, drive_content: list):
        self.drive_content = drive_content
        self._system_prompt = None
        self._client = None

    def _get_client(self):
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        return self._client

    def build_system_prompt(self) -> str:
        if self._system_prompt is not None:
            return self._system_prompt

        header = (
            "You are a helpful assistant with read-only access to documents from a Google Drive. "
            "Answer questions based on the document content provided below. "
            "If the answer is not found in the documents, say so clearly.\n\n"
        )

        doc_parts = []
        total_chars = len(header)
        truncated = 0

        for doc in self.drive_content:
            block = f"=== DOCUMENT: {doc['filename']} ===\n{doc['content']}\n\n"
            if total_chars + len(block) > MAX_SYSTEM_CHARS:
                truncated += 1
                continue
            doc_parts.append(block)
            total_chars += len(block)

        if truncated:
            logger.warning(f"System prompt truncated: {truncated} document(s) omitted due to size limit.")
            doc_parts.append(
                f"[Note: {truncated} additional document(s) were omitted because the total content exceeded the context limit.]\n"
            )

        self._system_prompt = header + "".join(doc_parts)
        return self._system_prompt

    def chat(self, message: str, history: list) -> str:
        client = self._get_client()
        system_prompt = self.build_system_prompt()

        messages = []
        for turn in history:
            role = turn.get("role")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )

        return response.content[0].text
