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

function usage() {
  console.error('Usage: node scripts/with-root-env.mjs [--env <file>] [--] <command> [args...]');
}

const args = process.argv.slice(2);
let envFileName;
const commandArgs = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--env') {
    envFileName = args[index + 1];
    index += 1;

    if (!envFileName || envFileName.startsWith('--')) {
      usage();
      process.exit(1);
    }

    continue;
  }

  if (arg === '--') {
    commandArgs.push(...args.slice(index + 1));
    break;
  }

  commandArgs.push(arg);
}

if (commandArgs.length === 0) {
  usage();
  process.exit(1);
}

const selectedEnvPath = envFileName ? resolve(rootDir, envFileName) : undefined;

if (selectedEnvPath && !existsSync(selectedEnvPath)) {
  console.error(
    `找不到环境文件 ${selectedEnvPath}。请把 .env.supabase.example 复制为 .env.supabase，并填入 Supabase 连接串。`,
  );
  process.exit(1);
}

const merged = {
  ...readEnvFile(resolve(rootDir, '.env')),
  ...readEnvFile(resolve(process.cwd(), '.env')),
  ...(selectedEnvPath ? readEnvFile(selectedEnvPath) : {}),
};

for (const [key, value] of Object.entries(merged)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const command = commandArgs.join(' ');
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
