# palmshed/auth server

Authentication service deployed to Vercel.

## Local development

```bash
npm install
cp .env.example .env
npm run dev -w @palmshed/auth-server
```

## Configuration

All configuration is through environment variables. See `.env.example` for the full list.

## Deployment

```bash
vercel --cwd apps/server
```
