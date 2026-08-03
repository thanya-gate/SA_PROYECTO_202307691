import { Request } from 'express';

export interface AuthContext {
  userId: string;
  email: string;
  roles: string[];
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
};
