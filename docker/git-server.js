const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/workspace';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      handleRequest(req, res, data);
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

function handleRequest(req, res, data) {
  const url = req.url;
  const method = req.method;

  console.log(`${method} ${url}`, data);

  if (method === 'GET' && url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', workspace: WORKSPACE_DIR }));
    return;
  }

  if (method === 'POST' && url === '/clone') {
    handleClone(req, res, data);
  } else if (method === 'POST' && url === '/pull') {
    handlePull(req, res, data);
  } else if (method === 'POST' && url === '/commit') {
    handleCommit(req, res, data);
  } else if (method === 'GET' && url === '/status') {
    handleStatus(req, res, data);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
}

function handleClone(req, res, data) {
  const { repository, token, branch = 'main' } = data;
  
  if (!repository || !token) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'repository and token are required' }));
    return;
  }

  const repoDir = path.join(WORKSPACE_DIR, path.basename(repository, '.git'));
  const cloneUrl = repository.startsWith('http') 
    ? repository.replace('https://', `https://x-access-token:${token}@`)
    : `https://x-access-token:${token}@github.com/${repository}.git`;

  // Remove existing directory if it exists
  exec(`rm -rf "${repoDir}"`, (error) => {
    const command = `git clone --depth 1 --branch ${branch} "${cloneUrl}" "${repoDir}"`;
    
    exec(command, { env: { ...process.env, GIT_ASKPASS: '/usr/local/bin/git-askpass', GIT_PASSWORD: token } }, (error, stdout, stderr) => {
      if (error) {
        console.error('Clone error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          error: 'Clone failed', 
          details: stderr || error.message,
          exitCode: error.code 
        }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Repository cloned successfully',
        directory: repoDir,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      }));
    });
  });
}

function handlePull(req, res, data) {
  const { repository, token, branch = 'main' } = data;
  
  if (!repository) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'repository is required' }));
    return;
  }

  const repoDir = path.join(WORKSPACE_DIR, path.basename(repository, '.git'));
  
  if (!fs.existsSync(repoDir)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Repository not cloned yet' }));
    return;
  }

  const command = `cd "${repoDir}" && git pull origin ${branch}`;
  
  exec(command, { env: { ...process.env, GIT_ASKPASS: '/usr/local/bin/git-askpass', GIT_PASSWORD: token } }, (error, stdout, stderr) => {
    if (error) {
      console.error('Pull error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        error: 'Pull failed', 
        details: stderr || error.message,
        exitCode: error.code 
      }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Repository updated successfully',
      stdout: stdout.trim(),
      stderr: stderr.trim()
    }));
  });
}

function handleCommit(req, res, data) {
  const { repository, token, message, files = [], branch = 'main' } = data;
  
  if (!repository || !message) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'repository and message are required' }));
    return;
  }

  const repoDir = path.join(WORKSPACE_DIR, path.basename(repository, '.git'));
  
  if (!fs.existsSync(repoDir)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Repository not cloned yet' }));
    return;
  }

  // Write files if provided
  for (const file of files) {
    const filePath = path.join(repoDir, file.path);
    const fileDir = path.dirname(filePath);
    
    // Ensure directory exists
    exec(`mkdir -p "${fileDir}"`, () => {
      fs.writeFileSync(filePath, file.content);
    });
  }

  const commands = [
    `cd "${repoDir}"`,
    'git add .',
    `git commit -m "${message}"`,
    `git push origin ${branch}`
  ].join(' && ');

  exec(commands, { env: { ...process.env, GIT_ASKPASS: '/usr/local/bin/git-askpass', GIT_PASSWORD: token } }, (error, stdout, stderr) => {
    if (error) {
      console.error('Commit error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        error: 'Commit failed', 
        details: stderr || error.message,
        exitCode: error.code 
      }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Changes committed and pushed successfully',
      stdout: stdout.trim(),
      stderr: stderr.trim()
    }));
  });
}

function handleStatus(req, res, data) {
  const { repository } = data;
  
  if (!repository) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'repository is required' }));
    return;
  }

  const repoDir = path.join(WORKSPACE_DIR, path.basename(repository, '.git'));
  
  if (!fs.existsSync(repoDir)) {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      cloned: false,
      message: 'Repository not cloned yet'
    }));
    return;
  }

  const command = `cd "${repoDir}" && git status --porcelain`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Status error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        error: 'Status check failed', 
        details: stderr || error.message 
      }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ 
      cloned: true,
      clean: stdout.trim() === '',
      changes: stdout.trim().split('\n').filter(line => line.trim()),
      directory: repoDir
    }));
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Git operations server running on port ${PORT}`);
});