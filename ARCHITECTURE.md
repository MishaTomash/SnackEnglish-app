# Архів Архітектури SnackEnglish

## Фронтенд (src/) - React + Vite + Telegram WebApp

- **app/**: Ініціалізація додатку (App.tsx, main.tsx).
- **pages/**: Головні екрани (Home, Games, DuelLobby, Profile, Settings, Leaderboard).
- **widgets/**: Великі UI блоки (BottomNav).
- **entities/**: Бізнес-логіка та типи сутностей (user, word, unit).
- **games/**: Логіка соло-ігор (hangman, quick-pick, word-match) та їх реєстр (registry.ts).
- **duels/**: Логіка мультиплеєра (word-clash, sockets).
- **shared/**: Загальні UI компоненти, API клієнт, утиліти для Telegram та Web Speech API.
- **store/**: Глобальний стейт (zustand/redux) для прогресу, юзера, лідерборду.

## Бекенд (backend/src/) - Node.js + Express + MongoDB

- **bot.ts / index.ts**: Точки входу для Telegram бота та Express сервера.
- **socket.ts**: Обробка WebSockets для дуелей.
- **controllers/ & routes/**: REST API для юзерів, ігор, прогресу, лідерборду.
- **models/**: Mongoose схеми (User, Game, Word, Unit, UserProgress, Friendship, DuelInvite).
- **services/**: Складна бізнес-логіка (contentService.ts, gameService.ts, cronService.ts).
- **duels/**: Адаптери для мультиплеєрних ігор (WordClashAdapter.ts).
- **utils/spacedRepetition.ts**: Алгоритм інтервального повторення.

## Історія Змін (Changelog)

- [Додай сюди свій перший запис після наступної задачі]
