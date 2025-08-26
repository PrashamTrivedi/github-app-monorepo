import { Hono } from 'hono';
import type { WebhookPayload } from '@github-app/shared';
import type { Env } from '../types.js';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

// GitHub webhook endpoint
webhookRoutes.post('/', async (c) => {
  try {
    const signature = c.req.header('x-hub-signature-256');
    const eventType = c.req.header('x-github-event');
    
    if (!signature || !eventType) {
      return c.json({ error: 'Missing webhook headers' }, 400);
    }

    const payload = await c.req.json() as WebhookPayload;
    
    // Handle different webhook events
    switch (eventType) {
      case 'installation':
        await handleInstallation(c, payload);
        break;
      case 'issues':
        await handleIssues(c, payload);
        break;
      case 'pull_request':
        await handlePullRequest(c, payload);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

async function handleInstallation(c: any, payload: WebhookPayload) {
  const { action, installation } = payload;
  
  if (action === 'created' && installation) {
    // Store installation in D1 database
    await c.env.DB.prepare(
      'INSERT INTO installations (id, account_id, account_login, account_type) VALUES (?, ?, ?, ?)'
    ).bind(
      installation.id,
      installation.account.id,
      installation.account.login,
      installation.account.type
    ).run();
    
    console.log(`App installed for ${installation.account.login}`);
  }
}

async function handleIssues(c: any, payload: WebhookPayload) {
  const { action, issue, repository } = payload;
  
  if (action === 'opened' && issue && repository) {
    console.log(`New issue #${issue.number} in ${repository.full_name}: ${issue.title}`);
    // Add issue handling logic here
  }
}

async function handlePullRequest(c: any, payload: WebhookPayload) {
  const { action, pull_request, repository } = payload;
  
  if (action === 'opened' && pull_request && repository) {
    console.log(`New PR #${pull_request.number} in ${repository.full_name}: ${pull_request.title}`);
    // Add PR handling logic here
  }
}