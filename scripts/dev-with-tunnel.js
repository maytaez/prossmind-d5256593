#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Starting HTTPS dev server with public tunnel...\n');

// Start Vite dev server
const vite = spawn('npm', ['run', 'dev'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

// Wait a bit for the server to start, then start ngrok
setTimeout(() => {
  console.log('\n🌐 Starting ngrok tunnel...\n');

  const ngrok = spawn('ngrok', ['http', '8080', '--log=stdout'], {
    stdio: 'inherit',
    shell: true
  });

  ngrok.on('error', (err) => {
    console.error('❌ Error starting ngrok:', err.message);
    console.log('\n💡 Make sure ngrok is installed: brew install ngrok/ngrok/ngrok');
    console.log('💡 Or sign up at https://ngrok.com/ and configure your auth token');
  });

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    vite.kill();
    ngrok.kill();
    process.exit();
  });

  process.on('SIGTERM', () => {
    vite.kill();
    ngrok.kill();
    process.exit();
  });

}, 3000);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  vite.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  vite.kill();
  process.exit();
});
