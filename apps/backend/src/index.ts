import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

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

// Error handling middleware
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return c.json({ 
      success: false, 
      error: message 
    }, 500);
  }
});

// Routes
app.route('/webhooks', webhookRoutes);
app.route('/api', apiRoutes);
app.route('/git', gitRoutes);

export default app;