/**
 * File lock implementation
 * Used for mutual exclusion control during server startup
 * // CN: 文件锁实现
 * // CN: 用于服务器启动时的互斥控制
 */

import {
	type FileHandle,
	mkdir,
	open,
	readFile,
	unlink,
} from "node:fs/promises";
import * as path from "node:path";
import { LOCK_TIMEOUT } from "./constants";

interface LockInfo {
	pid: number;
	acquiredAt: number;
}

/**
 * Check if a process is alive
 * // CN: 检查进程是否存活
 */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		// EN: ESRCH: Process does not exist // CN: ESRCH: 进程不存在
		if (err.code === "ESRCH") {
			return false;
		}
		// EN: EPERM: Process exists but no permission // CN: EPERM: 进程存在但无权限访问
		if (err.code === "EPERM") {
			return true;
		}
		return false;
	}
}

/**
 * Wait for specified time
 * // CN: 等待指定时间
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * File lock class
 * // CN: 文件锁类
 */
export class FileLock {
	private handle: FileHandle | null = null;
	private lockPath: string;

	constructor(lockPath: string) {
		this.lockPath = lockPath;
	}

	/**
	 * Try to acquire exclusive lock
	 * @param timeout - Timeout in milliseconds, 0 means no wait
	 * @returns Whether the lock was acquired successfully
	 * // CN: 尝试获取排他锁
	 * // CN: @param timeout 超时时间（毫秒），0 表示不等待
	 * // CN: @returns 是否成功获取锁
	 */
	async tryAcquire(timeout: number = 0): Promise<boolean> {
		const startTime = Date.now();

		// EN: Ensure directory exists // CN: 确保目录存在
		await mkdir(path.dirname(this.lockPath), { recursive: true });

		while (true) {
			try {
				// EN: Open file in exclusive write mode // CN: 以排他写模式打开文件
				this.handle = await open(this.lockPath, "wx");

				// EN: Write PID and timestamp // CN: 写入 PID 和时间戳
				const lockInfo: LockInfo = {
					pid: process.pid,
					acquiredAt: Date.now(),
				};
				await this.handle.write(JSON.stringify(lockInfo));

				return true;
			} catch (err: unknown) {
				const error = err as NodeJS.ErrnoException;
				if (error.code === "EEXIST") {
					// EN: Lock file exists, check if expired // CN: 锁文件已存在，检查是否过期
					if (await this.isLockStale()) {
						await this.forceRelease();
						continue;
					}

					if (timeout === 0 || Date.now() - startTime >= timeout) {
						return false;
					}

					// EN: Wait and retry // CN: 等待后重试
					await sleep(100);
					continue;
				}
				throw err;
			}
		}
	}

	/**
	 * Check if lock is expired (holding process died or timeout)
	 * // CN: 检查锁是否过期（持有进程已死亡或超时）
	 */
	private async isLockStale(): Promise<boolean> {
		try {
			const content = await readFile(this.lockPath, "utf-8");
			const { pid, acquiredAt } = JSON.parse(content) as LockInfo;

			// EN: Check if process is alive // CN: 检查进程是否存活
			if (!isProcessAlive(pid)) {
				return true;
			}

			// EN: Check if timeout // CN: 检查是否超时
			if (Date.now() - acquiredAt > LOCK_TIMEOUT) {
				return true;
			}

			return false;
		} catch {
			// EN: File corrupted or not exists, treat as expired // CN: 文件损坏或不存在，视为过期
			return true;
		}
	}

	/**
	 * Force release expired lock
	 * // CN: 强制释放过期锁
	 */
	private async forceRelease(): Promise<void> {
		try {
			await unlink(this.lockPath);
		} catch {
			// EN: Ignore deletion failure // CN: 忽略删除失败
		}
	}

	/**
	 * Release the lock
	 * // CN: 释放锁
	 */
	async release(): Promise<void> {
		if (this.handle) {
			await this.handle.close();
			this.handle = null;
		}
		try {
			await unlink(this.lockPath);
		} catch {
			// EN: Ignore deletion failure // CN: 忽略删除失败
		}
	}
}
