import { Hono } from 'hono';
import type { Env } from '../types.js';
import { verifyWebhookSignature, getInstallationRepositories } from '../lib/github-auth.js';
import { storeInstallation, deleteInstallation, storeWebhookEvent } from '../lib/database.js';

// Webhook payload type since we can't import from shared
interface WebhookPayload {
  action: string;
  installation?: {
    id: number;
    account: {
      id: number;
      login: string;
      type: 'User' | 'Organization';
    };
    permissions: Record<string, string>;
  };
  repository?: {
    id: number;
    full_name: string;
  };
  issue?: {
    number: number;
    title: string;
  };
  pull_request?: {
    number: number;
    title: string;
    merged: boolean;
  };
}

export const webhookRoutes = new Hono<{ Bindings: Env }>();

// GitHub webhook endpoint
webhookRoutes.post('/', async (c) => {
  try {
    const signature = c.req.header('x-hub-signature-256');
    const eventType = c.req.header('x-github-event');
    
    if (!signature || !eventType) {
      return c.json({ error: 'Missing webhook headers' }, 400);
    }

    // Get raw body for signature verification
    const body = await c.req.text();
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const payload = JSON.parse(body) as WebhookPayload;
    
    // Store webhook event for debugging
    await storeWebhookEvent(c.env.DB, {
      event_type: eventType,
      action: payload.action || null,
      installation_id: payload.installation?.id || null,
      repository_id: payload.repository?.id || null,
      payload: body,
      processed: false
    });
    
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
  
  if (!installation) return;
  
  const env: Env = c.env;
  
  try {
    switch (action) {
      case 'created':
      case 'new_permissions_accepted':
        // Get installation repositories
        const repositories = await getInstallationRepositories(installation.id, env);
        
        // Store installation with repositories
        const installationWithRepos = {
          ...installation,
          repositories
        };
        
        await storeInstallation(env.DB, installationWithRepos);
        console.log(`App installed for ${installation.account.login} with ${repositories.length} repositories`);
        break;
        
      case 'deleted':
        await deleteInstallation(env.DB, installation.id);
        console.log(`App uninstalled for ${installation.account.login}`);
        break;
        
      case 'suspend':
        console.log(`App suspended for ${installation.account.login}`);
        break;
        
      case 'unsuspend':
        console.log(`App unsuspended for ${installation.account.login}`);
        break;
        
      default:
        console.log(`Unhandled installation action: ${action}`);
    }
  } catch (error) {
    console.error('Error handling installation webhook:', error);
  }
}

async function handleIssues(_c: any, payload: WebhookPayload) {
  const { action, issue, repository } = payload;
  
  if (issue && repository) {
    console.log(`Issue ${action}: #${issue.number} in ${repository.full_name}: ${issue.title}`);
    
    // Store the event for potential processing
    // Add custom issue handling logic here based on your needs
    switch (action) {
      case 'opened':
        // Handle new issue creation
        break;
      case 'closed':
        // Handle issue closure
        break;
      case 'labeled':
      case 'unlabeled':
        // Handle label changes
        break;
    }
  }
}

async function handlePullRequest(_c: any, payload: WebhookPayload) {
  const { action, pull_request, repository } = payload;
  
  if (pull_request && repository) {
    console.log(`Pull request ${action}: #${pull_request.number} in ${repository.full_name}: ${pull_request.title}`);
    
    // Add custom PR handling logic here based on your needs
    switch (action) {
      case 'opened':
        // Handle new PR creation
        break;
      case 'closed':
        // Handle PR closure (check if merged)
        if (pull_request.merged) {
          console.log(`PR #${pull_request.number} was merged`);
        }
        break;
      case 'synchronize':
        // Handle PR updates
        break;
      case 'ready_for_review':
        // Handle when PR becomes ready for review
        break;
    }
  }
}