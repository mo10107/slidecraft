# Slidecraft

> From prompt to pitch deck in seconds. AI-powered slide builder.

Slidecraft is a presentation builder powered by AI. Create, edit, and export professional presentations using AI agents with support for multiple LLM providers.

## Features

- AI-generated presentations from text prompts
- Slide editor with rich text editing (Plate.js)
- AI image generation (Fal.ai)
- Web search-enhanced content (Tavily)
- Google OAuth authentication (NextAuth.js)
- Export to PPTX
- Presentation sharing
- Notes and notebook support
- Docker-ready deployment

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js with Google OAuth
- **AI**: OpenAI, Google Gemini, Together AI, LangChain, LangGraph
- **Image AI**: Fal.ai
- **Vector DB**: Pinecone
- **File uploads**: UploadThing
- **Styling**: Tailwind CSS

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- PostgreSQL database

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/presentation_ai"

# Auth (required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"  # generate with: openssl rand -base64 32

# Google OAuth (optional — for Google sign-in)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AI Providers (at least one recommended)
GEMINI_API_KEY=""
GEMINI_KEY=""
GEMINI_MODEL=""

# Image hosting
UNSPLASH_ACCESS_KEY=""
```

### 3. Set up the database

```bash
pnpm db:push
```

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start development server (Turbopack) |
| `pnpm build`     | Build for production                 |
| `pnpm start`     | Start production server              |
| `pnpm db:push`   | Push Prisma schema to database       |
| `pnpm db:studio` | Open Prisma Studio (DB GUI)          |
| `pnpm lint`      | Lint code with Biome                 |
| `pnpm check:fix` | Auto-fix lint and format issues      |

---

## Docker

### Build and run with Docker

```bash
docker build -t presentation-ai .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/presentation_ai" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your-secret" \
  presentation-ai
```

### Docker Compose (recommended)

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/presentation_ai
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: your-secret
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: presentation_ai
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up
```

---

## Project Structure

```
src/
├── ai/              # AI agents, tools, and LLM utilities
├── app/             # Next.js App Router (pages, API routes, server actions)
├── components/      # React components (presentation editor, UI, etc.)
├── hooks/           # Custom React hooks
├── lib/             # Shared utilities and helpers
├── server/          # Server-only code (auth, DB, AI)
├── states/          # Global client state (Zustand)
├── styles/          # Global CSS
└── types/           # TypeScript type declarations
prisma/
└── schema.prisma    # Database schema
```
