import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createApp({ servePublic: false });
  }
  const { app } = await appPromise;
  app(req as unknown as Parameters<typeof app>[0], res as unknown as Parameters<typeof app>[1]);
}
