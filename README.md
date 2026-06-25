# Grid Tactics

Онлайн «Морской бой» на двоих: расстановка кораблей, бой в реальном времени и 3D-поле. Интерфейс на русском.

## Стек

| Часть | Технологии |
|-------|------------|
| Frontend | React 19, Vite, React Three Fiber, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Архитектура | Feature-Sliced Design (`app`, `pages`, `widgets`, `features`, `entities`, `shared`) |

## Режимы игры

- **Классика** — стандартный флот (1×4, 2×3, 3×2, 4×1)
- **Один в поле воин** — 16 однопалубных кораблей

## Быстрый старт (разработка)

```bash
npm run install:all
```

В двух терминалах:

```bash
npm run dev:backend    # порт 3001
npm run dev:frontend   # порт 5173
```

Открой `http://localhost:5173`.

## Продакшен

```bash
npm run install:all
npm run build
npm run start
```

Приложение и Socket.IO доступны на одном порту (по умолчанию `3001`). Если собран `frontend/dist`, сервер отдаёт статику и SPA сам.

### Переменные окружения

Скопируй `.env.example` в `.env`:

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию `3001`) |
| `NODE_ENV` | `production` для продакшена |
| `CLIENT_ORIGIN` | CORS origin для API (в проде обычно не нужен) |

Для отдельного фронта в dev можно задать `VITE_SOCKET_URL` в `frontend/.env`.

## Ассеты (`frontend/public`)

| Файл | Назначение |
|------|------------|
| `scene.gltf` + `scene.bin` | Бумажный корабль на экране входа |
| `pirate_island/scene.gltf` + `scene.bin` + `textures/` | Остров на экране входа |
| `pirate_ship.glb` | Корабли на игровом поле |
| `music.mp3`, `shot.mp3` | Фоновая музыка и звук выстрела (опционально) |

Без бинарных файлов моделей 3D-сцена на экране входа не загрузится.

## Структура проекта

```
first-ver/
├── backend/           # Express + Socket.IO, игровая логика
├── frontend/
│   ├── public/        # Статика и 3D-модели
│   └── src/
│       ├── app/       # Роутер, глобальные стили
│       ├── pages/     # welcome, lobby, game
│       ├── widgets/   # 3D-поле, расстановка, сцена входа
│       ├── features/  # Аудио, уведомления, сессия, расстановка
│       ├── entities/  # Корабль
│       └── shared/    # API, конфиг, утилиты, UI
├── package.json       # Скрипты сборки и запуска
└── .env.example
```

## Скрипты

| Команда | Действие |
|---------|----------|
| `npm run install:all` | Установка зависимостей backend и frontend |
| `npm run build` | Сборка frontend в `frontend/dist` |
| `npm run start` | Запуск backend (и статики, если есть dist) |
| `npm run dev:backend` | Backend в режиме разработки |
| `npm run dev:frontend` | Vite dev server |

## Игровой процесс

1. Введи имя на экране входа.
2. В лобби создай игру или присоединись по коду.
3. Расставь корабли на своём поле.
4. По очереди стреляй по полю соперника до уничтожения всего флота.
