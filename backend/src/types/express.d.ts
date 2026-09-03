export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: TelegramUser;
    }
  }
}
