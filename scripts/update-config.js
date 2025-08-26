#!/usr/bin/env node

/**
 * Configuration update helper for Cloudflare infrastructure
 * This script helps update wrangler.jsonc files with actual resource IDs
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function readJsonc(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Remove comments and trailing commas for JSON parsing
    const jsonContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    
    return JSON.parse(jsonContent);
  } catch (error) {
    log(`Error reading ${filePath}: ${error.message}`, 'red');
    return null;
  }
}

function writeJsonc(filePath, data) {
  try {
    // Pretty print with 2 spaces indentation
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content);
    log(`✓ Updated ${filePath}`, 'green');
  } catch (error) {
    log(`Error writing ${filePath}: ${error.message}`, 'red');
  }
}

function updateWranglerConfig() {
  const backendConfigPath = path.join(__dirname, '../apps/backend/wrangler.jsonc');
  const uiConfigPath = path.join(__dirname, '../apps/ui/wrangler.jsonc');
  
  log('Cloudflare Configuration Update Helper', 'blue');
  log('=====================================', 'blue');
  log('');
  
  // Read current configuration
  const backendConfig = readJsonc(backendConfigPath);
  if (!backendConfig) {
    log('Failed to read backend configuration', 'red');
    return;
  }
  
  log('Current backend configuration loaded', 'green');
  log('');
  
  // Display current placeholder IDs
  log('Current placeholder IDs that need to be updated:', 'yellow');
  log('');
  
  // D1 Database IDs
  log('D1 Database IDs:', 'bright');
  console.log(`  Development: ${backendConfig.d1_databases?.[0]?.database_id || 'N/A'}`);
  console.log(`  Preview: ${backendConfig.d1_databases?.[0]?.preview_database_id || 'N/A'}`);
  if (backendConfig.env?.staging?.d1_databases?.[0]) {
    console.log(`  Staging: ${backendConfig.env.staging.d1_databases[0].database_id}`);
  }
  if (backendConfig.env?.production?.d1_databases?.[0]) {
    console.log(`  Production: ${backendConfig.env.production.d1_databases[0].database_id}`);
  }
  log('');
  
  // KV Namespace IDs
  log('KV Namespace IDs:', 'bright');
  console.log(`  Development: ${backendConfig.kv_namespaces?.[0]?.id || 'N/A'}`);
  console.log(`  Preview: ${backendConfig.kv_namespaces?.[0]?.preview_id || 'N/A'}`);
  if (backendConfig.env?.staging?.kv_namespaces?.[0]) {
    console.log(`  Staging: ${backendConfig.env.staging.kv_namespaces[0].id}`);
  }
  if (backendConfig.env?.production?.kv_namespaces?.[0]) {
    console.log(`  Production: ${backendConfig.env.production.kv_namespaces[0].id}`);
  }
  log('');
  
  // Container Image
  log('Container Image:', 'bright');
  console.log(`  Current: ${backendConfig.containers?.[0]?.image || 'N/A'}`);
  log('');
  
  log('To get the actual IDs, run these commands:', 'yellow');
  log('');
  log('Get D1 Database IDs:', 'bright');
  log('  wrangler d1 list');
  log('');
  log('Get KV Namespace IDs:', 'bright');
  log('  wrangler kv:namespace list');
  log('');
  log('Example update commands:', 'yellow');
  log('');
  log('1. Update D1 database ID:', 'bright');
  log("   node scripts/update-config.js --d1-dev 'abc123-def456-ghi789'");
  log('');
  log('2. Update KV namespace ID:', 'bright');
  log("   node scripts/update-config.js --kv-dev 'xyz789-uvw456-rst123'");
  log('');
  log('3. Update container image:', 'bright');
  log("   node scripts/update-config.js --container-image 'your-registry.com/github-git-container:latest'");
  log('');
}

// Parse command line arguments for updates
function parseArgs() {
  const args = process.argv.slice(2);
  const updates = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    if (key && value) {
      updates[key.replace(/^--/, '')] = value;
    }
  }
  
  return updates;
}

function applyUpdates(updates) {
  if (Object.keys(updates).length === 0) {
    return;
  }
  
  const backendConfigPath = path.join(__dirname, '../apps/backend/wrangler.jsonc');
  const backendConfig = readJsonc(backendConfigPath);
  
  if (!backendConfig) {
    log('Failed to read backend configuration for updates', 'red');
    return;
  }
  
  let modified = false;
  
  // Apply updates
  Object.entries(updates).forEach(([key, value]) => {
    switch (key) {
      case 'd1-dev':
        if (backendConfig.d1_databases?.[0]) {
          backendConfig.d1_databases[0].database_id = value;
          modified = true;
          log(`Updated dev D1 database ID: ${value}`, 'green');
        }
        break;
        
      case 'd1-dev-preview':
        if (backendConfig.d1_databases?.[0]) {
          backendConfig.d1_databases[0].preview_database_id = value;
          modified = true;
          log(`Updated dev preview D1 database ID: ${value}`, 'green');
        }
        break;
        
      case 'd1-staging':
        if (backendConfig.env?.staging?.d1_databases?.[0]) {
          backendConfig.env.staging.d1_databases[0].database_id = value;
          modified = true;
          log(`Updated staging D1 database ID: ${value}`, 'green');
        }
        break;
        
      case 'd1-production':
        if (backendConfig.env?.production?.d1_databases?.[0]) {
          backendConfig.env.production.d1_databases[0].database_id = value;
          modified = true;
          log(`Updated production D1 database ID: ${value}`, 'green');
        }
        break;
        
      case 'kv-dev':
        if (backendConfig.kv_namespaces?.[0]) {
          backendConfig.kv_namespaces[0].id = value;
          modified = true;
          log(`Updated dev KV namespace ID: ${value}`, 'green');
        }
        break;
        
      case 'kv-dev-preview':
        if (backendConfig.kv_namespaces?.[0]) {
          backendConfig.kv_namespaces[0].preview_id = value;
          modified = true;
          log(`Updated dev preview KV namespace ID: ${value}`, 'green');
        }
        break;
        
      case 'kv-staging':
        if (backendConfig.env?.staging?.kv_namespaces?.[0]) {
          backendConfig.env.staging.kv_namespaces[0].id = value;
          modified = true;
          log(`Updated staging KV namespace ID: ${value}`, 'green');
        }
        break;
        
      case 'kv-production':
        if (backendConfig.env?.production?.kv_namespaces?.[0]) {
          backendConfig.env.production.kv_namespaces[0].id = value;
          modified = true;
          log(`Updated production KV namespace ID: ${value}`, 'green');
        }
        break;
        
      case 'container-image':
        if (backendConfig.containers?.[0]) {
          backendConfig.containers[0].image = value;
          modified = true;
          log(`Updated container image: ${value}`, 'green');
        }
        break;
        
      default:
        log(`Unknown update key: ${key}`, 'yellow');
    }
  });
  
  if (modified) {
    writeJsonc(backendConfigPath, backendConfig);
  } else {
    log('No valid updates were applied', 'yellow');
  }
}

// Main execution
const updates = parseArgs();

if (Object.keys(updates).length > 0) {
  applyUpdates(updates);
} else {
  updateWranglerConfig();
}