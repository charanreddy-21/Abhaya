import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const command = process.argv[2] ?? 'dev';
const allowedCommands = new Set(['dev', 'build', 'start']);

if (!allowedCommands.has(command)) {
  console.error(`Unsupported web command: ${command}`);
  process.exit(1);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = resolve(rootDir, 'apps', 'web');
const nextBin = resolve(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const childCommand = process.execPath;
const childArgs = [nextBin, command];
const childEnv = { ...process.env };

for (const key of Object.keys(childEnv)) {
  if (key.toLowerCase() === 'npm_config_workspace' || key.toLowerCase() === 'npm_config_workspaces') {
    delete childEnv[key];
  }
}

const child = spawn(childCommand, childArgs, {
  cwd: webDir,
  env: {
    ...childEnv,
    NEXT_TELEMETRY_DISABLED: '1',
    npm_config_workspaces: 'false',
  },
  shell: false,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
