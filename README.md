# Tasknote — Task Management App

A full-stack task management application with a React frontend and NestJS/PostgreSQL backend. Built as a developer portfolio project demonstrating modern full-stack practices, accessible UI, and robust data handling.

[GitHub Repository](https://github.com/Amir97t/todo)

## Overview

Tasknote is a task management application featuring task and checklist management, multiple lists with an Inbox, search, filtering, sorting, and a responsive interface that works across desktop, tablet, and mobile.

The frontend is a React/Vite single-page application communicating with a REST API powered by NestJS, Prisma 7, and PostgreSQL.

## Features

- **Task management** — create, edit, delete, complete, and uncomplete tasks
- **Multiple lists** — organize tasks into custom lists with a protected Inbox
- **Inbox view** — manage active tasks in the selected list
- **Completed view** — view completed tasks across all lists
- **Checklist items** — add, edit, delete, toggle, and reorder checklist items with inline progress
- **Search** — global search across task titles and descriptions with debounced queries
- **Filtering & sorting** — server-side task filtering and newest/oldest sorting
- **Responsive UI** — desktop sidebar, tablet layout transitions, and mobile drawer
- **Light/dark theme** — persisted theme preference with CSS-variable-based theming
- **Legacy data migration** — one-time migration from localStorage to the backend with conflict handling
- **Mutation error feedback** — accessible error banner with human-readable messages
- **Duplicate-submit protection** — prevents duplicate in-flight mutations per resource
- **Accessible dialogs & drawer** — focus trapping, focus restoration, Escape handling, and inert mobile drawer
- **Persistent UI preferences** — selected list and sidebar state are preserved locally

## Tech Stack

| Layer                | Technologies                                                   |
| -------------------- | -------------------------------------------------------------- |
| **Frontend**         | React 19, Vite 8, React Router 7, Tailwind CSS 4, Lucide React |
| **Testing**          | Vitest 5, Testing Library, jsdom                               |
| **Backend**          | NestJS 12, Prisma 7, PostgreSQL                                |
| **Database Adapter** | `@prisma/adapter-pg`                                           |

## Architecture

```text
React / Vite SPA
        │
        │ REST API
        ▼
NestJS
        │
        ▼
Prisma 7
        │
        ▼
PostgreSQL
```

The frontend uses a **prop-driven architecture**. Server-backed application state and mutation actions are coordinated through the `useAppData` hook and passed to pages and components through props.

No global state library such as Redux or Zustand is used. This keeps the current application architecture relatively small and explicit while avoiding unnecessary global state management.

The backend is organized by feature, with dedicated modules for lists, tasks, checklists, Prisma/database access, health checks, validation, and error handling.

## Project Structure

### Frontend

```text
todo-app/
├── src/
│   ├── components/
│   │   ├── common/       # Shared UI components
│   │   ├── layout/       # Sidebar, Navbar, search, mobile drawer
│   │   ├── list/         # List-related components
│   │   ├── task/         # Task and checklist components
│   │   └── ui/           # Reusable UI primitives
│   ├── context/          # ThemeProvider
│   ├── hooks/            # Application and reusable hooks
│   ├── lib/              # API, migration, query, constants, utilities
│   ├── pages/            # Inbox and Completed pages
│   ├── routes/           # React Router configuration
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
└── test/                 # Vitest + Testing Library tests
```

### Backend

```text
todo-api/
├── src/
│   ├── app/
│   │   ├── filters/      # Global exception handling
│   │   └── pipes/        # Validation configuration
│   ├── common/           # Shared application constants
│   ├── generated/       # Generated Prisma Client
│   ├── health/           # Health endpoint
│   ├── lists/            # List CRUD
│   ├── prisma/           # PrismaService and database access
│   ├── tasks/            # Task and checklist CRUD
│   ├── app.module.ts
│   ├── configure-app.ts
│   └── main.ts
└── prisma/
    ├── schema.prisma
    └── migrations/       # Database migrations
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ or a compatible PostgreSQL environment

### 1. Clone the repository

```bash
git clone https://github.com/Amir97t/todo.git
cd todo
```

The frontend and backend are maintained as separate projects, so clone the backend repository separately if needed.

### 2. Install dependencies

#### Frontend

```bash
cd todo-app
npm install
```

#### Backend

```bash
cd ../todo-api
npm install
```

### 3. Configure environment variables

#### Backend

Create `todo-api/.env` from the provided example:

```bash
cd todo-api
cp .env.example .env
```

Configure the values for your environment.

#### Frontend

Create `todo-app/.env` from the provided example:

```bash
cd ../todo-app
cp .env.example .env
```

Set `VITE_API_URL` to the backend base URL.

### 4. Set up the database

From the backend directory:

```bash
cd ../todo-api
npx prisma generate
npx prisma migrate dev
```

The initial migrations create the required database structure and system Inbox list.

### 5. Start the development servers

Run the backend:

```bash
cd todo-api
npm run start:dev
```

By default, the backend runs on:

```text
http://localhost:3000
```

Run the frontend in a second terminal:

```bash
cd todo-app
npm run dev
```

The Vite development server runs on its default local port, typically:

```text
http://localhost:5173
```

## Environment Variables

### Backend

| Variable       | Required | Description                              | Example                                                        |
| -------------- | -------- | ---------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string             | `postgresql://user:pass@localhost:5432/todo_dev?schema=public` |
| `PORT`         | No       | Backend server port                      | `3000`                                                         |
| `CORS_ORIGIN`  | Yes      | Comma-separated allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173`                  |

### Frontend

| Variable       | Required | Description          | Example                 |
| -------------- | -------- | -------------------- | ----------------------- |
| `VITE_API_URL` | Yes      | Backend API base URL | `http://localhost:3000` |

> **Never commit real secrets.** Environment files containing secrets are gitignored. Use the provided `.env.example` files as templates.

## Available Scripts

### Frontend

| Script    | Command        | Purpose                              |
| --------- | -------------- | ------------------------------------ |
| `dev`     | `vite`         | Start the Vite development server    |
| `build`   | `vite build`   | Create a production build            |
| `lint`    | `eslint .`     | Run ESLint                           |
| `preview` | `vite preview` | Preview the production build locally |
| `test`    | `vitest run`   | Run the frontend test suite          |

### Backend

| Script            | Command                 | Purpose                               |
| ----------------- | ----------------------- | ------------------------------------- |
| `build`           | `nest build`            | Build the NestJS application          |
| `start`           | `nest start`            | Start the built NestJS application    |
| `start:dev`       | `nest start --watch`    | Start the backend in development mode |
| `start:prod`      | `node dist/main`        | Start the production build            |
| `prisma:generate` | `prisma generate`       | Generate Prisma Client                |
| `prisma:migrate`  | `prisma migrate dev`    | Run development migrations            |
| `prisma:deploy`   | `prisma migrate deploy` | Apply committed migrations            |
| `lint`            | `oxlint src/ test/`     | Run backend lint checks               |
| `test`            | `vitest run`            | Run the backend test suite            |

## Testing

### Frontend

```bash
cd todo-app
npm test
```

The frontend test suite currently contains **157 tests** covering areas including:

- Application data and migration logic
- Query and filtering behavior
- Concurrent mutation protection
- Error handling
- Dialog and mobile drawer accessibility
- Focus management
- Search behavior
- Task and checklist interactions
- Responsive UI behavior

### Backend

```bash
cd todo-api
npm test
```

The backend test suite currently contains **12 tests** covering core API and application behavior.

The project uses **Vitest** for testing and **Testing Library** for frontend component integration tests.

## Deployment

> **Current status: not yet deployed.**
>
> The following platforms represent the intended demo deployment target for the portfolio version of the project.

| Part         | Target | Purpose                     |
| ------------ | ------ | --------------------------- |
| **Frontend** | Vercel | Host the React/Vite SPA     |
| **Backend**  | Render | Host the NestJS API         |
| **Database** | Neon   | Managed PostgreSQL database |

The frontend requires `VITE_API_URL` to point to the deployed backend API.

The backend requires `DATABASE_URL` and an appropriate `CORS_ORIGIN` configuration for the deployed frontend.

The production deployment process will use the existing Prisma migration system rather than modifying the database schema manually.

## Current Scope / Limitations

Tasknote is currently designed as a **single-user portfolio application**.

- No authentication or authorization
- No multi-user ownership or data isolation
- No rate limiting
- No dedicated production request-size limits
- No production-grade security-header configuration
- No advanced observability or monitoring
- No pagination or virtualization for very large task collections

The current application is suitable for **demo and portfolio deployment**, but it should not be treated as a fully hardened public multi-user production service.

There are also a small number of asynchronous frontend tests that have shown timing-related flakiness during full-suite execution. These do not currently correspond to identified application functionality bugs and remain part of the testing backlog.

## Roadmap

- **Authentication & authorization** — add user accounts and ownership boundaries
- **Production hardening** — rate limiting, security headers, request-size controls, structured logging, and monitoring
- **CI/CD** — automated testing, linting, builds, and deployment through GitHub Actions
- **Dependency cleanup** — remove unused dependencies and continue security/audit maintenance
- **Test stabilization** — eliminate timing-sensitive test flakiness
- **Pagination / virtualization** — improve scalability for large task collections
- **Multi-user support** — introduce ownership, sharing, and collaboration features

## Author

**Amir**

[GitHub — Amir97t](https://github.com/Amir97t)

## License

This project is currently **unlicensed** and is intended for portfolio demonstration purposes.
