const express = require('express');
const { spawn } = require('child_process');
const app = express();
const port = 8080;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    workspace: process.env.WORKSPACE_DIR || '/workspace'
  });
});

// Execute command endpoint
app.post('/exec', async (req, res) => {
  try {
    const { command, env = {}, workingDir = '/workspace', timeout = 300000 } = req.body;

    if (!Array.isArray(command) || command.length === 0) {
      return res.status(400).json({
        exitCode: 1,
        stdout: '',
        stderr: 'Invalid command format. Expected array of strings.',
        error: 'Invalid command'
      });
    }

    console.log(`Executing command: ${command.join(' ')} in ${workingDir}`);

    const startTime = Date.now();
    
    // Prepare environment variables
    const execEnv = {
      ...process.env,
      ...env,
      PATH: process.env.PATH,
      HOME: '/root'
    };

    // Spawn the process
    const child = spawn(command[0], command.slice(1), {
      cwd: workingDir,
      env: execEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000); // Give 5 seconds for graceful termination
    }, timeout);

    // Collect stdout
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      
      const duration = Date.now() - startTime;
      
      if (isTimedOut) {
        return res.json({
          exitCode: 124, // Common timeout exit code
          stdout,
          stderr: stderr + '\nProcess timed out',
          error: 'Process timed out',
          duration,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`Command completed with exit code: ${code}, duration: ${duration}ms`);
      
      res.json({
        exitCode: code || 0,
        stdout,
        stderr,
        duration,
        timestamp: new Date().toISOString()
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      console.error('Process error:', error);
      
      res.json({
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + error.message,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      exitCode: 1,
      stdout: '',
      stderr: error.message,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    workspace: process.env.WORKSPACE_DIR || '/workspace',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      GIT_SSL_NO_VERIFY: process.env.GIT_SSL_NO_VERIFY
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Git container server listening on port ${port}`);
  console.log(`Workspace directory: ${process.env.WORKSPACE_DIR || '/workspace'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});