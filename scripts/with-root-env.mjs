import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return parse(readFileSync(path));
}

const merged = {
  ...readEnvFile(resolve(rootDir, '.env')),
  ...readEnvFile(resolve(process.cwd(), '.env')),
};

for (const [key, value] of Object.entries(merged)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/with-root-env.mjs <command> [args...]');
  process.exit(1);
}

const command = args.join(' ');
const child = spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
