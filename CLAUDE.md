# RAG Chat (Nutralogos)

## Summary & Goals
- Next.js 15 (App Router) приложение для RAG-чата с Qdrant и OpenAI.
- Панель модератора по адресу `/moderator` для загрузки файлов, управления БД и настройками.
- JWT-сессии через NextAuth (credentials, `ADMIN_EMAIL`/`ADMIN_PASSWORD`).

## Tech Stack
- React 19.2.1, Next.js 15, TypeScript (strict), Tailwind 4.
- NextAuth, better-sqlite3 (локальная БД), WebSocket сервер (`websocket-server.js`).
- Qdrant + OpenAI SDK, LangChain.

## Key Dirs
- `src/app/` — роуты App Router (`page.tsx`, `layout.tsx`), `/moderator`, API в `src/app/api/`.
- `src/lib/` — логика RAG, настройки, auth, websocket.
- `src/components/` — общие UI (Logout, Providers, Markdown).
- `scripts/` — миграции/инициализация БД, тестовые тулзы.
- `data/` — локальная SQLite (`rag-chat.db`).

## Coding Rules
- Только функциональные компоненты и хуки; без классов/OOP.
- Пропсы деструктурировать в сигнатуре.
- Код на TypeScript, стили Tailwind/shadcn/ui.
- Минимум абстракций: прямые вызовы из UI → API/библиотек.
- Пути и ссылки теперь `/moderator` (вместо `/admin`).

## Architecture Notes
- UI и API на App Router; защита маршрутов через `middleware.ts` + роли.
- RAG: загрузка → парсинг/чанкинг (`src/lib/*processor*`) → Qdrant/vector DB.
- Настройки и контекст чата берутся через `/api/moderator/settings`, кэшируются в `chat-context`.
- WebSocket сервер поднимается отдельно (`npm run dev` запускает Next + ws).

