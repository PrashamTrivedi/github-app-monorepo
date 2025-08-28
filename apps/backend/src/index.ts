import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { webhookRoutes } from './routes/webhooks.js';
import { apiRoutes } from './routes/api.js';
import { gitRoutes } from './routes/git.js';
import { GitContainer } from './lib/git-container.js';
import { HealthCheckResponseSchema } from './schemas/api.js';
import type { Env } from './types.js';

const app = new OpenAPIHono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://your-domain.pages.dev'],
  credentials: true,
}));

// Health check
app.openapi(
  {
    method: 'get',
    path: '/',
    summary: 'Health check endpoint',
    description: 'Returns API status and basic information',
    responses: {
      200: {
        description: 'API health status',
        content: {
          'application/json': {
            schema: HealthCheckResponseSchema,
          },
        },
      },
    },
    tags: ['Health'],
  },
  (c) => {
    return c.json({
      message: 'GitHub App Backend API',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString()
    });
  }
);

// Environment validation middleware
app.use('/api/*', async (c, next) => {
  if (!c.env.DB) {
    return c.json({ 
      success: false, 
      error: 'Database not configured' 
    }, 503);
  }
  await next();
});

app.use('/git/*', async (c, next) => {
  if (!c.env.DB) {
    return c.json({ 
      success: false, 
      error: 'Database not configured' 
    }, 503);
  }
  if (!c.env.GIT_CONTAINER) {
    return c.json({ 
      success: false, 
      error: 'Container service not configured' 
    }, 503);
  }
  await next();
});

app.use('/webhooks/*', async (c, next) => {
  if (!c.env.DB) {
    return c.json({ 
      success: false, 
      error: 'Database not configured' 
    }, 503);
  }
  await next();
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

// OpenAPI documentation endpoints
app.doc('/api-docs', {
  openapi: '3.0.0',
  info: {
    title: 'GitHub App Backend API',
    version: '1.0.0',
    description: 'Backend API for GitHub App with Cloudflare Workers and Containers'
  },
  servers: [
    {
      url: '/',
      description: 'Current server'
    }
  ]
});

app.get('/swagger', swaggerUI({ 
  url: '/api-docs'
}));

export default app;

// Export container class for Cloudflare runtime
export { GitContainer };