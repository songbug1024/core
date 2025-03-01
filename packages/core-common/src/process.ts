import { isWindows, isMacintosh, setImmediate } from './platform';

interface IProcess {
  platform: string;
  env: object;

  cwd(): string;
  nextTick(callback: (...args: any[]) => void): number;
}

declare const process: IProcess;
const safeProcess: IProcess =
  typeof process === 'undefined'
    ? {
        cwd(): string {
          return '/';
        },
        env: Object.create(null),
        get platform(): string {
          return isWindows ? 'win32' : isMacintosh ? 'darwin' : 'linux';
        },
        nextTick(callback: (...args: any[]) => void): number {
          return setImmediate(callback);
        },
      }
    : process;

export const cwd = safeProcess.cwd;
export const env = safeProcess.env;
export const platform = safeProcess.platform;
export const nextTick = safeProcess.nextTick;
