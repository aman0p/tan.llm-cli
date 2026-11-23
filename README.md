<div align="center">

<br />
<br />

<h1>tan.llm</h1>

<p>A terminal-based AI coding agent.</p>

<p>Plan, chat, and build inside your local project with a Bun-powered CLI, Hono API, Prisma ORM, Neon Auth, and OpenRouter streaming.</p>

<br />

<p>
  <a href="https://cwa.run/bun?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_bun"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" /></a>&nbsp;
  <a href="https://cwa.run/opentui?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_opentui"><img src="https://img.shields.io/badge/OpenTUI-111111?style=for-the-badge" alt="OpenTUI" /></a>&nbsp;
  <a href="https://cwa.run/react?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_react"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>&nbsp;
  <a href="https://cwa.run/hono?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_hono"><img src="https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white" alt="Hono" /></a>&nbsp;
  <a href="https://cwa.run/neon?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_neon"><img src="https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=black" alt="Neon" /></a>&nbsp;
  <a href="https://img.shields.io/badge/OpenRouter-484A5B?style=for-the-badge&logo=openrouter&logoColor=white"><img src="https://img.shields.io/badge/OpenRouter-484A5B?style=for-the-badge" alt="OpenRouter" /></a>&nbsp;
  <a href="https://cwa.run/coderabbit?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_coderabbit"><img src="https://img.shields.io/badge/CodeRabbit-FF6C37?style=for-the-badge&logo=rabbitmq&logoColor=white" alt="CodeRabbit" /></a>&nbsp;
  <a href="https://cwa.run/railway?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=badge_railway"><img src="https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Railway" /></a>
</p>

</div>

<br />

## Tutorial

Each chapter has a matching branch so you can check out the code at any point in the tutorial:

| Branch | Chapter |
|--------|---------|
| `main` | Final project |
| `01-project-setup-component-architecture` | Project setup and component architecture |
| `02-ui-infrastructure` | Terminal UI infrastructure |
| `03-routing-screen-layout` | Routing and screen layout |
| `04-server-shared-database` | Server, shared package, and database |
| `05-ai-chat-streamiing` | AI chat streaming |
| `06-session-management-config` | Session management and configuration |
| `07-tool-calling` | Tool calling |
| `08-user-experience` | User experience polish |
| `09-billing` | Billing and credit metering |
| `10-client-side-tool-execution` | Client-side tool execution |
| `11-the-end` | Final tutorial state |

```bash
git checkout 07-tool-calling  # example: jump to tool calling
```

## Features

- **Terminal AI Chat** - Run an AI coding assistant directly in your terminal with an OpenTUI and React interface
- **Plan and Build Modes** - Use read-only planning tools or enable write, edit, and shell execution tools for implementation
- **Streaming Responses** - Stream model output through the AI SDK with persisted session history
- **Local Project Tools** - Read files, list directories, glob, grep, write files, edit files, and run shell commands inside the current project
- **Any OpenRouter Model** - Pick any tool-capable model from OpenRouter's live catalog; no hardcoded model registry
- **Bring Your Own Key** - Store your OpenRouter API key locally with `/set-key`, or use a server-wide env fallback
- **Persistent Sessions** - Store authenticated user sessions and messages in Postgres via Prisma
- **Skills** - Reusable `SKILL.md` instruction packs, discovered locally and loaded by the agent on demand
- **Permission Rules** - Ordered `allow` / `ask` / `deny` rules for shell, file, and skill actions, with interactive approvals
- **Question Tool** - Let the agent pause and ask multiple-choice questions when it needs a decision
- **Neon Auth** - Authenticate the CLI through a browser-based OAuth 2.1 flow with refresh tokens

## Getting Started

### Prerequisites

- [Bun](https://cwa.run/bun?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=prerequisites_bun) installed
- PostgreSQL database, such as [Neon](https://cwa.run/neon?utm_source=github&utm_medium=readme&utm_campaign=tan.llm&utm_content=prerequisites_neon)
- [Neon Auth](https://neon.com/docs/auth) (Managed Better Auth) enabled on your Neon branch, with the OAuth provider plugin
- An [OpenRouter](https://openrouter.ai/keys) API key

### 1. Clone and install

```bash
git clone git@github.com:code-with-antonio/tan.llm.git
cd tan.llm
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

```bash
API_URL=http://localhost:3000
DATABASE_URL=

# Neon Auth (Managed Better Auth)
NEON_AUTH_BASE_URL=
NEON_AUTH_CLIENT_ID=
NEON_AUTH_RESOURCE=

# Optional server-wide fallback; CLI /set-key takes precedence
OPENROUTER_API_KEY=
```

### 3. Set up Neon Auth

tan.llm uses Managed Better Auth's OAuth provider plugin so the CLI can sign users in through the browser with PKCE and refresh tokens.

1. In the Neon console, enable **Managed Better Auth** on your branch and note its **Auth URL**. This becomes `NEON_AUTH_BASE_URL`.
2. Register `http://localhost:3000` as a trusted domain for the branch.
3. Enable the **OAuth provider** plugin with these settings:
   - **Login page URL:** `http://localhost:3000/auth/login`
   - **Consent page URL:** `http://localhost:3000/auth/consent`
   - **Resource URL:** `http://localhost:3000/nightcode-api` — this becomes `NEON_AUTH_RESOURCE` and must be different from the Auth host. This value is registered in Neon Auth, so update it in the Neon console before changing it here.
4. Create a **public** OAuth client with the exact redirect URI `http://localhost:3000/auth/callback`. No client secret is needed. Copy its client ID into `NEON_AUTH_CLIENT_ID`.
5. Configure the social and/or email sign-in providers you want on the hosted login page.

The server serves a minimal login page at `/auth/login` and consent page at `/auth/consent`, which pass the signed `oauth_query` back to Managed Better Auth. After approval, `/auth/callback` forwards the code to the CLI's ephemeral localhost callback server.

> **Note:** Neon user IDs differ from the previous Clerk IDs, so existing sessions will no longer be visible. All users must sign in again.

### 4. Set up your OpenRouter key

Run `/set-key` in the CLI and paste your OpenRouter API key. It is stored in `~/.tan.llm/auth.json` with owner-only permissions and sent with every request.

Alternatively, set `OPENROUTER_API_KEY` in `.env` as a server-wide fallback. A CLI-stored key always takes precedence, so you can switch keys at any time without restarting the server.

To use a model, run `/models`. tan.llm fetches OpenRouter's live catalog, filters out batch and non-tool-capable models, and lets you search by name or full slug. The first tool-capable model in the catalog is selected by default.

To use a model by its slug directly, run `/model` and paste the slug, for example `thinkingmachines/inkling-2-mini`. You can also set a per-model max token limit there. Custom slugs are saved in `~/.tan.llm/custom-models.json` and also appear in `/models`.

If OpenRouter reports insufficient credits, run `/max-tokens` to set a lower default output limit for every reply. Your selected model, mode, and theme are saved in `~/.tan.llm/preferences.json`.

Run `/doctor` at any time to check server reachability, authentication, model selection, token limits, and your OpenRouter credit balance.

### 5. Set up the database

Generate the Prisma client and apply the schema:

```bash
bun run db:generate
bun run db:push
```

### 6. Run the server

```bash
bun run dev:server
```

The API runs on `http://localhost:3000`.

### 7. Run the CLI

In another terminal:

```bash
bun run dev:cli
```

To build and link the local CLI binary:

```bash
bun run link:cli
tan.llm
```

## Deployment

The server is a single Bun process. The CLI runs locally on each user's machine and talks to it over HTTPS.

### 1. Configure Neon Auth for your domain

Use the same Neon Auth setup as local development, replacing `localhost:3000` with your deployed domain:

- **Trusted domain:** `https://<your-domain>`
- **Login page URL:** `https://<your-domain>/auth/login`
- **Consent page URL:** `https://<your-domain>/auth/consent`
- **Redirect URI:** `https://<your-domain>/auth/callback`

Keep `NEON_AUTH_RESOURCE` as the value registered in Neon Auth. Changing it requires updating the Neon console first, otherwise login fails with `invalid_target`.

### 2. Deploy the server

#### Railway

Railway does not auto-detect Bun, so the included `Dockerfile` is used automatically.

1. Create a new project and choose **Deploy from GitHub repo**.
2. Add the environment variables below in the service's **Variables** tab.
3. In **Settings → Build**, confirm the builder is **Dockerfile** using `Dockerfile`.
4. In **Settings → Deploy**, set **Start Command** to `bun run start` and **Healthcheck Path** to `/health`.
5. In **Settings → Networking**, click **Generate Domain** to get your public URL.
6. Apply the schema once before the first deploy with `bun run db:push` using the production `DATABASE_URL`.

#### Any host

Set these environment variables on your host (see `.env.example`):

```bash
DATABASE_URL=
NEON_AUTH_BASE_URL=
NEON_AUTH_CLIENT_ID=
NEON_AUTH_RESOURCE=http://localhost:3000/nightcode-api
OPENROUTER_API_KEY=
PORT=3000
```

Build and start:

```bash
bun install
bun run db:push
bun run build
bun run start
```

The server listens on `PORT` (default `3000`) and exposes `GET /health` for health checks.

### 3. Point the CLI at it

Each user sets these in their shell before running `tan.llm`:

```bash
export API_URL=https://<your-domain>
export NEON_AUTH_BASE_URL=<same-as-server>
export NEON_AUTH_CLIENT_ID=<same-as-server>
export NEON_AUTH_RESOURCE=http://localhost:3000/nightcode-api
```

Run `/doctor` in the CLI to verify the connection.

## Skills

Skills are reusable instruction packs. Create one under your project or in your home directory:

```text
.tan.llm/skills/git-release/SKILL.md     # project skill, shareable with your team
~/.tan.llm/skills/review.md              # personal skill, available everywhere
```

```markdown
---
name: Git Release
description: Prepare release notes and version bumps
---

## Workflow

1. Summarize merged changes since the previous tag.
2. Propose a version bump before changing files.
3. Run `scripts/changelog.ts` after approval.
```

- The skill ID comes from the folder or file name (use lowercase kebab-case).
- A `description` is required so the agent knows when to load the skill.
- Related scripts and references live beside `SKILL.md`; paths inside the skill are relative to that directory.
- Use `/skills` to enable or disable skills, or write `@skill-id` in a prompt to request one explicitly.
- The agent can also call `loadSkill` itself when the task matches a skill's description.
- Project skills override global skills with the same ID.
- Add `metadata.opencode/autoinvoke: false` or `disable-model-invocation: true` to hide a skill from automatic discovery.

For compatibility, `.opencode/skills`, `.claude/skills`, and `.agents/skills` are also discovered.

## Permissions

Permission rules are enforced in the CLI before any local tool runs. Defaults allow all actions, except reads of `.env` files ask for approval. PLAN mode restrictions cannot be overridden.

Create `.tan.llm/config.json` in your project or `~/.tan.llm/config.json` globally:

```json
{
  "permissions": [
    { "action": "shell", "resource": "*", "effect": "ask" },
    { "action": "shell", "resource": "git status *", "effect": "allow" },
    { "action": "shell", "resource": "git push *", "effect": "deny" },
    { "action": "read", "resource": "*.env*", "effect": "ask" }
  ]
}
```

Supported actions: `read`, `edit`, `glob`, `grep`, `shell`, `skill`, `question`, and `*`. Resources are paths, shell commands, or skill IDs. Wildcards `*` and `?` are supported, and the last matching rule wins. Shell patterns ending in ` *` also match the bare command.

When a rule resolves to `ask`, you can allow once, allow always (saved as a project-scoped approval), or reject. Run `/permissions` to inspect the effective rule list and config paths.

> **Note:** Shell matching uses the command text, not a security sandbox. Commands can still do anything your user account can do. Use narrow allowlists for dangerous operations.

## Project Structure

```
packages/
├── cli/                         # OpenTUI + React terminal client
│   ├── bin/                     # tan.llm executable shim
│   └── src/
│       ├── components/          # Terminal UI components, dialogs, messages
│       ├── hooks/               # Chat and UI hooks
│       ├── layouts/             # Root terminal layouts
│       ├── lib/                 # API client, auth, OAuth, token refresh, local tool execution
│       ├── providers/           # Dialog, keyboard, prompt, theme, toast providers
│       └── screens/             # Home, new session, and session screens
├── database/                    # Prisma schema, generated client, database exports
├── server/                      # Hono API for auth, models, sessions, and chat
└── shared/                      # Shared schemas and tool contracts
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev:cli` | Start the CLI in watch mode |
| `bun run dev:server` | Start the Hono server with hot reload |
| `bun run start` | Start the production server (no hot reload) |
| `bun run build` | Generate the Prisma client and build both packages |
| `bun run build:cli` | Build the CLI package |
| `bun run build:server` | Build the server package |
| `bun run link:cli` | Build and link the `tan.llm` executable |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:push` | Apply the Prisma schema to `DATABASE_URL` |

## Packages

| Package | Description |
|---------|-------------|
| `@tan.llm/cli` | Terminal UI, key management, and client-side tool execution |
| `@tan.llm/server` | Hono API, OpenRouter streaming, Neon auth verification, and dynamic model catalog |
| `@tan.llm/database` | Prisma client and database schema |
| `@tan.llm/shared` | Shared Zod schemas and AI tool contracts |
