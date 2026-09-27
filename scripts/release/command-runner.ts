import { spawn } from 'node:child_process';

export interface CommandRunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly input?: string;
}

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: 0;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], options?: CommandRunOptions): Promise<CommandResult>;
}

export class CommandExecutionError extends Error {
  readonly code = 'command_failed';

  constructor(readonly exitCode: number | null) {
    super('Release command failed');
    this.name = 'CommandExecutionError';
  }
}

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;

function assertLiteral(value: string, label: string): void {
  if (!value || value.includes('\0')) throw new Error(`${label} is invalid`);
}

export function createCommandRunner(): CommandRunner {
  return {
    run: async (command, args, options = {}) => {
      assertLiteral(command, 'Command');
      args.forEach((arg) => assertLiteral(arg, 'Command argument'));
      const timeoutMs = options.timeoutMs ?? 120_000;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15 * 60_000) {
        throw new Error('Command timeout is invalid');
      }
      return await new Promise<CommandResult>((resolve, reject) => {
        const child = spawn(command, [...args], {
          cwd: options.cwd,
          env: options.env ?? process.env,
          shell: false,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        let exceeded = false;
        const append = (current: string, chunk: Buffer): string => {
          if (Buffer.byteLength(current) + chunk.byteLength > MAX_CAPTURE_BYTES) {
            exceeded = true;
            child.kill();
            return current;
          }
          return current + chunk.toString('utf8');
        };
        child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
        child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
        child.on('error', () => reject(new CommandExecutionError(null)));
        const timeout = setTimeout(() => child.kill(), timeoutMs);
        child.on('close', (exitCode) => {
          clearTimeout(timeout);
          if (exceeded || exitCode !== 0) reject(new CommandExecutionError(exitCode));
          else resolve({ stdout, stderr, exitCode: 0 });
        });
        if (options.input !== undefined) child.stdin.end(options.input);
        else child.stdin.end();
      });
    }
  };
}
