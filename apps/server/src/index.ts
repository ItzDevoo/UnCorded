import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { rateLimit } from 'elysia-rate-limit';
import { env } from './env.js';
import { betterAuthPlugin } from './middleware/auth.js';
import { userRoutes } from './routes/user.js';
import { serverRoutes } from './routes/server.js';
import { channelRoutes } from './routes/channel.js';
import { memberRoutes } from './routes/member.js';
import { inviteRoutes } from './routes/invite.js';

const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN ?? env.APP_URL,
      credentials: true,
    }),
  )
  .use(betterAuthPlugin)
  .use(
    rateLimit({
      max: env.RATE_LIMIT_MAX,
      duration: env.RATE_LIMIT_WINDOW_MS,
    }),
  )
  .use(userRoutes)
  .use(serverRoutes)
  .use(channelRoutes)
  .use(memberRoutes)
  .use(inviteRoutes)
  .get('/health', () => ({ status: 'ok' }))
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { code: 'NOT_FOUND', message: 'Route not found' };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return { code: 'VALIDATION_ERROR', message: error.message };
    }

    console.error('Unhandled error:', error);
    set.status = 500;
    return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
  })
  .listen(env.PORT);

console.log(`UnCorded server running on http://localhost:${app.server?.port}`);

export type App = typeof app;
