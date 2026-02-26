# korner-integrations-service

External integrations service. Handles AI generation (OpenAI, Replicate), webhooks, and email notifications.

## Commands

```bash
npm run build     # tsc
npm run dev       # tsc --watch
npm run start     # node dist/main.js
npm run lint      # eslint . --ext .ts,.tsx --fix
```

Note: uses `tsc --watch` for dev (no hot reload, requires restart for changes). Lint pattern differs from other services.

## Port

**3005** (default)

## Modules

| Module | Description |
|--------|-------------|
| `ai` | AI content generation via OpenAI |
| `replicate` | Image/video generation via Replicate API |
| `webhook` | Incoming webhook handlers (Replicate callbacks, etc.) |

## Background Services

- `dailyReminderService` — email reminders (dev env only)

## Middleware

- `authMiddleware` / `optionalAuthMiddleware` — JWT Bearer auth

## Key Utilities

- `src/utils/errorCodes.ts` — Centralized error codes
- `src/utils/mainServiceClient.ts` — HTTP client to korner-main-service
- `src/utils/resend.ts` — Email sending via Resend
- `src/utils/s3.ts` / `src/utils/ys3.ts` — S3 file operations (for AI-generated content)
- `src/utils/neurorouters.ts` — AI model routing logic

## Environment Variables

```
PORT=3005
NODE_ENV=development
ACCESS_TOKEN_SECRET
KORNER_MAIN_URL=http://localhost:3001
ACTIVE_ENV=dev
API_URL=http://localhost:3005
OPENAI_API_KEY
REPLICATE_API_TOKEN
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET=korner-lol
YC_ACCESS_KEY_ID, YC_SECRET_ACCESS_KEY
RESEND_API_KEY, RESEND_FROM_EMAIL=korner@korner.pro, RESEND_FROM_NAME=Korner App
TEAM_TELEGRAM_BOT_TOKEN, TEAM_TELEGRAM_CHAT_ID
LOKI_URL, SERVICE_NAME=korner-integrations-service
```

## Dependencies on Other Services

- **korner-main-service** — user data via `mainServiceClient`
