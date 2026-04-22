# n8n-nodes-imap-ai

An n8n community node for IMAP mailbox access with **first-class AI Agent support** (`usableAsTool: true`). Read, search, move, flag and download emails from any IMAP server — either as a regular workflow node or as a tool driven by the n8n AI Agent node.

> Built on top of [`imapflow`](https://github.com/postalsys/imapflow) (modern, Promise-based IMAP) and [`mailparser`](https://github.com/nodemailer/mailparser) for RFC822 MIME parsing.

---

## Why another IMAP node?

The existing community node `n8n-nodes-imap` works well for classic workflows, but was not designed for the n8n AI Agent tool protocol. This package is an independent implementation with three priorities:

1. **AI-ergonomic descriptions.** Every resource, operation and parameter has a description written for an LLM: what the tool does, when to pick it, what each filter means.
2. **Flat, JSON-shaped search input.** IMAP search criteria (`SINCE`, `UNSEEN`, `FROM`, etc.) are exposed as a collection with one field per criterion — the LLM fills a JSON object, the node translates it to an IMAP query.
3. **Binary-clean downloads.** Attachments and `.eml` files come through as n8n binary data, ready to hand off to Paperless-ngx, S3, a file node, or back to the agent.

---

## Installation

### In the n8n UI (self-hosted)

**Settings → Community Nodes → Install** → package name `n8n-nodes-imap-ai` → Install.

### As a custom node (link or manual install)

```bash
# in your n8n instance
cd ~/.n8n/custom
npm install n8n-nodes-imap-ai
# restart n8n
```

### Docker

Mount the custom directory and install inside the container, or extend the image:

```dockerfile
FROM n8nio/n8n:latest
USER root
RUN cd /home/node/.n8n/custom && npm install n8n-nodes-imap-ai
USER node
```

---

## Credentials

Create a credential of type **IMAP API**.

| Field | Description | Example |
| --- | --- | --- |
| Authentication | `Password` or `OAuth2 (XOAUTH2)` | `Password` |
| Host | IMAP server hostname | `imap.gmail.com` |
| Port | `993` (implicit TLS) or `143` | `993` |
| Use TLS | enable for port 993 | `true` |
| User | mailbox user / email | `you@example.com` |
| Password | account or **app password** | `xxxx-xxxx-xxxx-xxxx` |
| Access Token | OAuth2 token (only in OAuth2 mode) | — |
| TLS Options → Allow Self-Signed | set `false` for self-hosted Dovecot with a private CA | `true` |
| TLS Options → Min Version | lowest TLS version to negotiate | `TLSv1.2` |
| Advanced → Connection Timeout | socket timeout in ms | `30000` |
| Advanced → Disable Compression | turn off IMAP COMPRESS=DEFLATE | `false` |

### Gmail / Google Workspace

- Enable 2FA and use an **App Password** — Google refuses plain passwords over IMAP since 2022.
- Alternatively use `OAuth2 (XOAUTH2)` and hand over a fresh access token. This node does **not** refresh tokens on its own — pair it with an upstream OAuth2 credential node.

### Microsoft 365 / Outlook.com

- Basic auth is deprecated. Use `OAuth2 (XOAUTH2)` with a Graph-registered app (IMAP.AccessAsUser.All scope).

### Self-hosted (Dovecot, Stalwart, Mailcow)

- Plain password + TLS 1.2 on port 993.
- For internal CAs: set `Allow Self-Signed Certificates` to `false` **only** after you've installed your CA root in the n8n container — otherwise use `true`.

---

## Operations

### Resource: Email (10)

| Operation | What it does | Typical AI use |
| --- | --- | --- |
| `Search` | IMAP SEARCH with FROM/SUBJECT/SINCE/UNSEEN/FLAGGED/TEXT/BODY filters | "Find ungelesene Mails mit 'Rechnung' von letzter Woche" |
| `Get` | Fetch one message by UID, parsed subject/body/headers, optional attachments | "Lies Mail 4217 und fasse zusammen" |
| `Move` | Move UID → folder | "Verschiebe nach /Archive/2026/Rechnungen" |
| `Copy` | Copy UID → folder (keep original) | — |
| `Delete` | `\Deleted` + EXPUNGE | — |
| `Mark Read` / `Mark Unread` | `\Seen` flag toggle | — |
| `Flag` / `Unflag` | `\Flagged` (star) or custom keyword | "Markiere als Important" |
| `Append` | Upload raw RFC822 to a folder (from text or binary input) | "Save draft" |

### Resource: Mailbox (7)

`List`, `Create`, `Delete`, `Rename`, `Status`, `Quota`, `Test Connection`.

Agents should run `Mailbox: List` once before addressing specific folders, so they know the separator (`/`, `.`, `/[Gmail]/`) and which folders exist.

### Resource: Download (2)

- `Download Attachments` — all attachments of a UID into binary slots, with optional filename-substring and MIME-type (`application/pdf`, `image/*`) filters.
- `Download EML` — full raw RFC822 message as a single `.eml` binary.

---

## Example AI Agent workflow

Paste the JSON below into **Workflows → Import from clipboard**. It's a minimal "triage my inbox" agent: the AI Agent is wired to an OpenAI chat model and is given the IMAP node as a tool. The system prompt is kept short on purpose — the tool descriptions in this package do the heavy lifting.

> Replace `imap-ai` / `openai-cred` with your actual credential IDs after import.

```json
{
  "name": "IMAP AI Triage (demo)",
  "nodes": [
    {
      "parameters": {},
      "id": "1a",
      "name": "When chat message received",
      "type": "@n8n/n8n-nodes-langchain.chatTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "options": {
          "systemMessage": "Du bist ein E-Mail-Assistent. Nutze das Tool 'IMAP (AI)' um Mails zu suchen, zu lesen oder zu verschieben. Antworte knapp auf Deutsch."
        }
      },
      "id": "1b",
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.7,
      "position": [520, 300]
    },
    {
      "parameters": {
        "model": "gpt-4o-mini",
        "options": {}
      },
      "id": "1c",
      "name": "OpenAI Chat Model",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1,
      "position": [520, 500],
      "credentials": { "openAiApi": { "id": "openai-cred", "name": "OpenAI" } }
    },
    {
      "parameters": {
        "resource": "email",
        "operation": "search",
        "mailbox": "INBOX",
        "searchFilters": { "unseen": true },
        "options": { "limit": 20, "newestFirst": true }
      },
      "id": "1d",
      "name": "IMAP (AI)",
      "type": "n8n-nodes-imap-ai.imap",
      "typeVersion": 1,
      "position": [800, 500],
      "credentials": { "imapApi": { "id": "imap-ai", "name": "My IMAP" } }
    }
  ],
  "connections": {
    "When chat message received": {
      "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]]
    },
    "OpenAI Chat Model": {
      "ai_languageModel": [[{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]]
    },
    "IMAP (AI)": {
      "ai_tool": [[{ "node": "AI Agent", "type": "ai_tool", "index": 0 }]]
    }
  }
}
```

Example chat turns once the workflow is running:

- *"Habe ich neue Rechnungen seit Montag?"* → Agent calls `Email / Search` with `{ subject: "Rechnung", since: "2026-04-20", unseen: true }`.
- *"Zeig mir Mail 1423"* → `Email / Get` with `uid: 1423`.
- *"Verschiebe sie nach Archive/2026/Rechnungen"* → `Email / Move` with that UID and the target folder.

---

## Local development

```bash
git clone https://github.com/addpv/n8n-nodes-imap-ai.git
cd n8n-nodes-imap-ai
npm install
npm run build          # tsc + gulp build:icons
npm run lint           # ESLint with n8n-nodes-base rules
npm run dev            # tsc --watch
```

Then link into a local n8n instance:

```bash
# inside this repo
npm link

# in your n8n custom-nodes dir (create if missing)
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm init -y 2>/dev/null || true
npm link n8n-nodes-imap-ai

# start n8n — it auto-discovers linked packages
n8n start
```

Open `http://localhost:5678`, create an **IMAP API** credential, add an **IMAP (AI)** node, or wire it as a tool under an **AI Agent** node.

---

## Implemented / omitted / known limits

### Implemented (19 operations)

- **Mailbox (7):** List, Create, Delete, Rename, Status, Quota, Test Connection
- **Email (10):** Search, Get, Move, Copy, Delete, Mark Read, Mark Unread, Flag, Unflag, Append
- **Download (2):** Download Attachments (with filename/MIME filter), Download EML

### Deliberately not included

- **IDLE / push notifications.** That belongs in a separate trigger node, not a tool node.
- **Gmail-only thread ops (`X-GM-THRID`).** Non-portable across servers.
- **OAuth2 refresh flow.** Credentials take a pre-issued access token — pair with an upstream OAuth2 credential node for refresh.

### Known limits

- `hasAttachment` filter is a size heuristic (> 50 KB), not an exact BODYSTRUCTURE scan.
- No connection pool across `execute()` runs — a fresh IMAP connection per node execution, one socket shared across all items inside that execution.
- No automated test suite yet. Integration testing against Gmail / Dovecot / Stalwart is manual.
- `Delete` issues `\Deleted` + best-effort EXPUNGE. Gmail behaviour differs (moves to Trash).

---

## License

MIT © Dominik / addpv
