import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types.js';
import { verifyWebhookSignature, getInstallationRepositories } from '../lib/github-auth.js';
import { storeInstallation, deleteInstallation, storeWebhookEvent } from '../lib/database.js';
import { Logger, PerformanceTimer } from '../lib/logger.js';
import { 
  WebhookPayloadSchema,
  WebhookResponseSchema,
} from '../schemas/webhooks.js';
import {
  BadRequestResponseSchema,
  UnauthorizedResponseSchema,
  InternalServerErrorResponseSchema,
} from '../schemas/common.js';

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

export const webhookRoutes = new OpenAPIHono<{ Bindings: Env }>();

// GitHub webhook endpoint
webhookRoutes.openapi(
  {
    method: 'post',
    path: '/',
    summary: 'GitHub webhook endpoint',
    description: 'Handles GitHub webhook events for the app',
    request: {
      body: {
        content: {
          'application/json': {
            schema: WebhookPayloadSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Webhook processed successfully',
        content: {
          'application/json': {
            schema: WebhookResponseSchema,
          },
        },
      },
      400: {
        description: 'Missing required headers',
        content: {
          'application/json': {
            schema: BadRequestResponseSchema,
          },
        },
      },
      401: {
        description: 'Invalid webhook signature',
        content: {
          'application/json': {
            schema: UnauthorizedResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: InternalServerErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Webhooks'],
  },
  async (c) => {
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const signature = c.req.header('x-hub-signature-256');
      const eventType = c.req.header('x-github-event');
      
      logger.info('webhook', 'Received webhook request', {
        eventType,
        hasSignature: !!signature,
        userAgent: c.req.header('user-agent'),
        contentLength: c.req.header('content-length')
      });
      
      if (!signature || !eventType) {
        const duration = timer.end();
        logger.error('webhook', 'Missing required webhook headers', {
          hasSignature: !!signature,
          hasEventType: !!eventType,
          duration
        });
        return c.json({ error: 'Missing webhook headers' }, 400);
      }

      // Get raw body for signature verification
      const body = await c.req.text();
      
      logger.debug('webhook', 'Processing webhook payload', {
        eventType,
        payloadSize: body.length,
        signaturePresent: !!signature
      });
      
      // Verify webhook signature
      const signatureTimer = new PerformanceTimer();
      const isValid = await verifyWebhookSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET || '', c.env);
      const signatureDuration = signatureTimer.end();
      
      if (!isValid) {
        const duration = timer.end();
        logger.error('webhook', 'Invalid webhook signature verification failed', {
          eventType,
          signatureDuration,
          duration
        });
        return c.json({ error: 'Invalid signature' }, 401);
      }

      logger.debug('webhook', 'Webhook signature verified successfully', {
        eventType,
        signatureDuration
      });

      const payload = JSON.parse(body) as WebhookPayload;
      
      // Store webhook event for debugging
      const dbTimer = new PerformanceTimer();
      await storeWebhookEvent(c.env.DB, {
        event_type: eventType,
        action: payload.action || null,
        installation_id: payload.installation?.id || null,
        repository_id: payload.repository?.id || null,
        payload: body,
        processed: false
      });
      const dbDuration = dbTimer.end();
      
      logger.logDatabaseOperation('INSERT webhook_event', 'webhook_events', dbDuration, {
        eventType,
        action: payload.action,
        installationId: payload.installation?.id,
        repositoryId: payload.repository?.id
      });
      
      // Handle different webhook events
      let handlerResult = false;
      const handlerTimer = new PerformanceTimer();
      
      switch (eventType) {
        case 'installation':
          handlerResult = await handleInstallation(c, payload);
          break;
        case 'issues':
          handlerResult = await handleIssues(c, payload);
          break;
        case 'pull_request':
          handlerResult = await handlePullRequest(c, payload);
          break;
        default:
          logger.info('webhook', 'Unhandled webhook event type', {
            eventType,
            action: payload.action
          });
      }
      
      const handlerDuration = handlerTimer.end();
      const totalDuration = timer.end();
      
      logger.logWebhookEvent(eventType, payload.action || 'unknown', handlerResult, {
        installationId: payload.installation?.id,
        repositoryId: payload.repository?.id,
        handlerDuration,
        totalDuration
      });

      return c.json({ success: true });
    } catch (error) {
      const duration = timer.end();
      logger.error('webhook', 'Webhook processing error', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
);

async function handleInstallation(c: any, payload: WebhookPayload): Promise<boolean> {
  const { action, installation } = payload;
  
  if (!installation) return false;
  
  const env: Env = c.env;
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.info('webhook-handler', 'Processing installation webhook', {
    action,
    installationId: installation.id,
    accountLogin: installation.account.login,
    accountType: installation.account.type
  });
  
  try {
    switch (action) {
      case 'created':
      case 'new_permissions_accepted':
        // Get installation repositories
        logger.debug('webhook-handler', 'Fetching repositories for installation', {
          installationId: installation.id,
          action
        });
        
        const repositories = await getInstallationRepositories(installation.id, env);
        
        // Store installation with repositories
        const installationWithRepos = {
          ...installation,
          repositories
        };
        
        const dbTimer = new PerformanceTimer();
        await storeInstallation(env.DB, installationWithRepos);
        const dbDuration = dbTimer.end();
        
        logger.logDatabaseOperation('INSERT installation', 'installations', dbDuration, {
          installationId: installation.id,
          accountLogin: installation.account.login,
          repositoryCount: repositories.length
        });
        
        const duration = timer.end();
        logger.info('webhook-handler', 'App installation processed successfully', {
          installationId: installation.id,
          accountLogin: installation.account.login,
          repositoryCount: repositories.length,
          action,
          duration
        });
        break;
        
      case 'deleted':
        const deleteTimer = new PerformanceTimer();
        await deleteInstallation(env.DB, installation.id);
        const deleteDuration = deleteTimer.end();
        
        logger.logDatabaseOperation('DELETE installation', 'installations', deleteDuration, {
          installationId: installation.id,
          accountLogin: installation.account.login
        });
        
        const totalDuration = timer.end();
        logger.info('webhook-handler', 'App uninstallation processed successfully', {
          installationId: installation.id,
          accountLogin: installation.account.login,
          action,
          duration: totalDuration
        });
        break;
        
      case 'suspend':
        logger.info('webhook-handler', 'App suspended', {
          installationId: installation.id,
          accountLogin: installation.account.login
        });
        break;
        
      case 'unsuspend':
        logger.info('webhook-handler', 'App unsuspended', {
          installationId: installation.id,
          accountLogin: installation.account.login
        });
        break;
        
      default:
        logger.warn('webhook-handler', 'Unhandled installation action', {
          action,
          installationId: installation.id,
          accountLogin: installation.account.login
        });
        return false;
    }
    
    return true;
  } catch (error) {
    const duration = timer.end();
    logger.error('webhook-handler', 'Error handling installation webhook', {
      action,
      installationId: installation.id,
      accountLogin: installation.account.login,
      error: error instanceof Error ? error.message : String(error),
      duration
    });
    return false;
  }
}

async function handleIssues(c: any, payload: WebhookPayload): Promise<boolean> {
  const { action, issue, repository } = payload;
  const env: Env = c.env;
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  if (!issue || !repository) {
    logger.warn('webhook-handler', 'Missing issue or repository data in webhook', {
      hasIssue: !!issue,
      hasRepository: !!repository,
      action
    });
    return false;
  }
  
  logger.info('webhook-handler', 'Processing issue webhook', {
    action,
    issueNumber: issue.number,
    repositoryFullName: repository.full_name,
    issueTitle: issue.title?.substring(0, 100) || 'No title'
  });
  
  try {
    // Store the event for potential processing
    // Add custom issue handling logic here based on your needs
    switch (action) {
      case 'opened':
        logger.info('webhook-handler', 'Issue opened', {
          issueNumber: issue.number,
          repository: repository.full_name,
          issueTitle: issue.title?.substring(0, 100)
        });
        // Handle new issue creation
        break;
      case 'closed':
        logger.info('webhook-handler', 'Issue closed', {
          issueNumber: issue.number,
          repository: repository.full_name,
          issueTitle: issue.title?.substring(0, 100)
        });
        // Handle issue closure
        break;
      case 'labeled':
      case 'unlabeled':
        logger.info('webhook-handler', `Issue ${action}`, {
          issueNumber: issue.number,
          repository: repository.full_name,
          issueTitle: issue.title?.substring(0, 100)
        });
        // Handle label changes
        break;
      default:
        logger.info('webhook-handler', 'Unhandled issue action', {
          action,
          issueNumber: issue.number,
          repository: repository.full_name
        });
    }
    
    const duration = timer.end();
    logger.debug('webhook-handler', 'Issue webhook handled successfully', {
      action,
      issueNumber: issue.number,
      duration
    });
    
    return true;
  } catch (error) {
    const duration = timer.end();
    logger.error('webhook-handler', 'Error handling issue webhook', {
      action,
      issueNumber: issue.number,
      repository: repository.full_name,
      error: error instanceof Error ? error.message : String(error),
      duration
    });
    return false;
  }
}

async function handlePullRequest(c: any, payload: WebhookPayload): Promise<boolean> {
  const { action, pull_request, repository } = payload;
  const env: Env = c.env;
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  if (!pull_request || !repository) {
    logger.warn('webhook-handler', 'Missing pull request or repository data in webhook', {
      hasPullRequest: !!pull_request,
      hasRepository: !!repository,
      action
    });
    return false;
  }
  
  logger.info('webhook-handler', 'Processing pull request webhook', {
    action,
    prNumber: pull_request.number,
    repositoryFullName: repository.full_name,
    prTitle: pull_request.title?.substring(0, 100) || 'No title',
    merged: pull_request.merged
  });
  
  try {
    // Add custom PR handling logic here based on your needs
    switch (action) {
      case 'opened':
        logger.info('webhook-handler', 'Pull request opened', {
          prNumber: pull_request.number,
          repository: repository.full_name,
          prTitle: pull_request.title?.substring(0, 100)
        });
        // Handle new PR creation
        break;
      case 'closed':
        if (pull_request.merged) {
          logger.info('webhook-handler', 'Pull request merged', {
            prNumber: pull_request.number,
            repository: repository.full_name,
            prTitle: pull_request.title?.substring(0, 100)
          });
        } else {
          logger.info('webhook-handler', 'Pull request closed without merging', {
            prNumber: pull_request.number,
            repository: repository.full_name,
            prTitle: pull_request.title?.substring(0, 100)
          });
        }
        // Handle PR closure (check if merged)
        break;
      case 'synchronize':
        logger.info('webhook-handler', 'Pull request synchronized (updated)', {
          prNumber: pull_request.number,
          repository: repository.full_name,
          prTitle: pull_request.title?.substring(0, 100)
        });
        // Handle PR updates
        break;
      case 'ready_for_review':
        logger.info('webhook-handler', 'Pull request ready for review', {
          prNumber: pull_request.number,
          repository: repository.full_name,
          prTitle: pull_request.title?.substring(0, 100)
        });
        // Handle when PR becomes ready for review
        break;
      default:
        logger.info('webhook-handler', 'Unhandled pull request action', {
          action,
          prNumber: pull_request.number,
          repository: repository.full_name
        });
    }
    
    const duration = timer.end();
    logger.debug('webhook-handler', 'Pull request webhook handled successfully', {
      action,
      prNumber: pull_request.number,
      duration
    });
    
    return true;
  } catch (error) {
    const duration = timer.end();
    logger.error('webhook-handler', 'Error handling pull request webhook', {
      action,
      prNumber: pull_request.number,
      repository: repository.full_name,
      error: error instanceof Error ? error.message : String(error),
      duration
    });
    return false;
  }
}