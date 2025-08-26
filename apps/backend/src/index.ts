import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { App } from '@octokit/app';

import { webhookRoutes } from './routes/webhooks.js';
import { apiRoutes } from './routes/api.js';
import { gitRoutes } from './routes/git.js';
import type { Env } from './types.js';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://your-domain.pages.dev'],
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({ 
    message: 'GitHub App Backend API',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString()
  });
});

// Initialize GitHub App
app.use('*', async (c, next) => {
  const octokit = new App({
    appId: c.env.GITHUB_APP_ID,
    privateKey: c.env.GITHUB_PRIVATE_KEY,
    webhooks: {
      secret: c.env.GITHUB_WEBHOOK_SECRET,
    },
  });
  
  c.set('octokit', octokit);
  await next();
});

// Routes
app.route('/webhooks', webhookRoutes);
app.route('/api', apiRoutes);
app.route('/git', gitRoutes);

export default app;