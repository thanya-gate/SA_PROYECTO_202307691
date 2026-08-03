import 'express';

declare global {
  namespace Express {
    interface Request {
      context?: {
        sessionId: string;
        userId: string;
        email: string;
        roles: string[];
      };
    }
  }
}

export {};
