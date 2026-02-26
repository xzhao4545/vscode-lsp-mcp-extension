/**
 * 文件锁实现
 * 用于服务器启动时的互斥控制
 */

import { open, readFile, unlink, mkdir } from 'fs/promises';
import { FileHandle } from 'fs/promises';
import * as path from 'path';
import { LOCK_TIMEOUT } from './constants';

interface LockInfo {
  pid: number;
  acquiredAt: number;
}

/**
 * 检查进程是否存活
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch(error) {
    const err = error as NodeJS.ErrnoException;
    // ESRCH: 进程不存在
    if (err.code === 'ESRCH') {
      return false;
    }
    // EPERM: 进程存在但无权限访问
    if (err.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

/**
 * 等待指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 文件锁类
 */
export class FileLock {
  private handle: FileHandle | null = null;
  private lockPath: string;

  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  /**
   * 尝试获取排他锁
   * @param timeout 超时时间（毫秒），0 表示不等待
   * @returns 是否成功获取锁
   */
  async tryAcquire(timeout: number = 0): Promise<boolean> {
    const startTime = Date.now();

    // 确保目录存在
    await mkdir(path.dirname(this.lockPath), { recursive: true });

    while (true) {
      try {
        // 以排他写模式打开文件
        this.handle = await open(this.lockPath, 'wx');
        
        // 写入 PID 和时间戳
        const lockInfo: LockInfo = {
          pid: process.pid,
          acquiredAt: Date.now()
        };
        await this.handle.write(JSON.stringify(lockInfo));
        
        return true;
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          // 锁文件已存在，检查是否过期
          if (await this.isLockStale()) {
            await this.forceRelease();
            continue;
          }

          if (timeout === 0 || Date.now() - startTime >= timeout) {
            return false;
          }
          
          // 等待后重试
          await sleep(100);
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * 检查锁是否过期（持有进程已死亡或超时）
   */
  private async isLockStale(): Promise<boolean> {
    try {
      const content = await readFile(this.lockPath, 'utf-8');
      const { pid, acquiredAt } = JSON.parse(content) as LockInfo;

      // 检查进程是否存活
      if (!isProcessAlive(pid)) {
        return true;
      }

      // 检查是否超时
      if (Date.now() - acquiredAt > LOCK_TIMEOUT) {
        return true;
      }

      return false;
    } catch {
      // 文件损坏或不存在，视为过期
      return true;
    }
  }

  /**
   * 强制释放过期锁
   */
  private async forceRelease(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch {
      // 忽略删除失败
    }
  }

  /**
   * 释放锁
   */
  async release(): Promise<void> {
    if (this.handle) {
      await this.handle.close();
      this.handle = null;
    }
    try {
      await unlink(this.lockPath);
    } catch {
      // 忽略删除失败
    }
  }
}
