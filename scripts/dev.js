import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const children = [
  spawn(process.execPath, ['--watch', 'server.js'], {
    cwd: path.join(root, 'backend'),
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
  }),
];

let stopping = false;

function stopChildren(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Unable to start a ProjectVault development service:', error.message);
    stopChildren(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stopChildren(code || 0);
  });
}

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));
