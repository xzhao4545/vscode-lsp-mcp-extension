/**
 * 状态文件读写
 */

import * as crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { SERVER_STATE_FILE } from "./constants";
import { ServerState, type ServerStateData, StateUtils } from "./types";

/**
 * 状态文件管理器
 */
export class StateFile {
	private filePath: string;

	constructor(storagePath: string) {
		this.filePath = path.join(storagePath, SERVER_STATE_FILE);
	}

	/**
	 * 获取状态文件路径
	 */
	getPath(): string {
		return this.filePath;
	}

	/**
	 * 读取状态文件
	 */
	async read(): Promise<ServerStateData | null> {
		try {
			const content = await readFile(this.filePath, "utf-8");
			return JSON.parse(content) as ServerStateData;
		} catch {
			return null;
		}
	}

	/**
	 * 写入状态文件
	 */
	async write(data: ServerStateData): Promise<void> {
		await mkdir(path.dirname(this.filePath), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(data));
	}

	private createInstanceState(
		port: number,
	): Pick<ServerStateData, "port" | "pid" | "instanceId" | "startTime"> {
		return {
			port,
			pid: process.pid,
			instanceId: crypto.randomUUID(),
			startTime: Date.now(),
		};
	}

	private ensureInstanceState(
		port: number,
		rawState: ServerStateData | null,
	): Pick<ServerStateData, "port" | "pid" | "instanceId" | "startTime"> {
		if (rawState) {
			return {
				port: rawState.port,
				pid: rawState.pid,
				instanceId: rawState.instanceId,
				startTime: rawState.startTime,
			};
		}
		return this.createInstanceState(port);
	}

	/**
	 * 删除状态文件
	 */
	async remove(): Promise<void> {
		try {
			await unlink(this.filePath);
		} catch {
			// ignore
		}
	}

	/**
	 * 写入进程已启动状态
	 */
	async writeStarting(port: number): Promise<ServerStateData> {
		const data: ServerStateData = {
			...this.createInstanceState(port),
			state: ServerState.STARTING,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入运行中状态
	 */
	async writeRunning(
		port: number,
		rawState: ServerStateData,
	): Promise<ServerStateData> {
		const data: ServerStateData = {
			...this.ensureInstanceState(port, rawState),
			state: ServerState.RUNNING,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入重启中状态
	 */
	async writeRestarting(
		port: number,
		rawState: ServerStateData,
	): Promise<ServerStateData> {
		const data: ServerStateData = {
			...this.ensureInstanceState(port, rawState),
			state: ServerState.RESTARTING,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入已关闭状态
	 */
	async writeStopped(
		port: number,
		rawState: ServerStateData | null,
	): Promise<ServerStateData> {
		const data: ServerStateData = {
			...this.ensureInstanceState(port, rawState),
			state: ServerState.STOPPED,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入端口冲突错误
	 */
	async writePortConflict(
		port: number,
		rawState: ServerStateData | null,
		errorMessage?: string,
	): Promise<ServerStateData> {
		const s = rawState ? StateUtils.clearError(rawState.state) : 0;
		const data: ServerStateData = {
			...this.ensureInstanceState(port, rawState),
			state: ServerState.ERROR_PORT_CONFLICT | s,
			errorMessage,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入服务器已运行错误
	 */
	async writeAlreadyRunning(
		rawState: ServerStateData,
	): Promise<ServerStateData> {
		const s = StateUtils.clearError(rawState.state);
		const data: ServerStateData = {
			...rawState,
			state: ServerState.ERROR_ALREADY_RUNNING | s,
		};
		await this.write(data);
		return data;
	}
	/**
	 * 写入未知错误
	 */
	async writeError(
		port: number,
		rawState: ServerStateData | null,
		errorMessage?: string,
	): Promise<ServerStateData> {
		const s = rawState ? StateUtils.clearError(rawState.state) : 0;
		const data: ServerStateData = {
			...this.ensureInstanceState(port, rawState),
			state: ServerState.ERROR_UNKNOWN | s,
			errorMessage,
		};
		await this.write(data);
		return data;
	}
}
