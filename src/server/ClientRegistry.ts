/**
 * ClientRegistry - Manages all connected VSCode windows
 * // CN: 客户端注册表 - 管理所有连接的 VSCode 窗口
 */

import { isAbsolute, normalize, relative, resolve } from "node:path";
import type { MessageConnection } from "vscode-jsonrpc/node";
import type { Folder, ProjectInfo } from "../shared/types";

/** Client information */ // CN: 客户端信息
export interface ClientInfo {
	connection: MessageConnection;
	windowId: string;
	folders: Folder[];
	connectedAt: number;
}

export class ClientRegistry {
	private clients = new Map<string, ClientInfo>();
	private projectIndex = new Map<string, string>(); // projectPath -> windowId // CN: projectPath -> windowId

	/** Register window */ // CN: 注册窗口
	register(windowId: string, connection: MessageConnection, folders: Folder[]): void {
		// EN: Normalize paths // CN: 格式化路径
		folders = folders.map((f) => {
			f.path = ClientRegistry.normalizePath(f.path);
			return f;
		});
		this.clients.set(windowId, {
			connection,
			windowId,
			folders,
			connectedAt: Date.now(),
		});

		// EN: Build projectPath index // CN: 建立 projectPath 索引
		// TODO: [data] projectIndex silently overwrites entries for duplicate folder paths - no warning or error // CN: projectIndex 遇到重复路径时静默覆盖，没有任何警告或错误
		// TODO: [logic] No validation that paths exist or are accessible during registration // CN: 注册时未验证路径是否存在或可访问
		for (const folder of folders) {
			this.projectIndex.set(folder.path, windowId);
		}

		console.log(
			`[Registry] Window ${windowId} registered with ${folders.length} folders`,
		);
	}

	/** Unregister window */ // CN: 注销窗口
	unregister(windowId: string): void {
		const client = this.clients.get(windowId);
		if (client) {
			// EN: Clean up projectPath index // CN: 清理 projectPath 索引
			for (const folder of client.folders) {
				this.projectIndex.delete(folder.path);
			}
			this.clients.delete(windowId);
			console.log(`[Registry] Window ${windowId} unregistered`);
		}
	}

	/** Find client by project path */ // CN: 根据项目路径查找客户端
	findByProjectPath(projectPath: string): ClientInfo | undefined {
		const normalized = ClientRegistry.normalizePath(projectPath);
		const windowId = this.projectIndex.get(normalized);
		return windowId ? this.clients.get(windowId) : undefined;
	}

	/** Get all projects list */ // CN: 获取所有项目列表
	getAllProjects(): ProjectInfo[] {
		const result: ProjectInfo[] = [];
		for (const client of this.clients.values()) {
			for (const folder of client.folders) {
				result.push({ ...folder, windowId: client.windowId });
			}
		}
		return result;
	}

	/** Get all clients */ // CN: 获取所有客户端
	getAllClients(): ClientInfo[] {
		return Array.from(this.clients.values());
	}

	/** Number of clients */ // CN: 客户端数量
	get size(): number {
		return this.clients.size;
	}

	/** Normalize path */ // CN: 路径标准化
	static normalizePath(p: string): string {
		let normalized = normalize(resolve(p));
		// EN: Normalize Windows drive letter to uppercase // CN: Windows 盘符统一大写
		if (process.platform === "win32") {
			normalized = normalized.replace(/^([a-zA-Z]):/, (_, drive) => {
				return `${drive.toUpperCase()}:`;
			});
		}
		return normalized;
	}

	/**
	 * Check if target path equals root path or is under root path
	 * // CN: 检查目标路径是否等于根路径或位于根路径下
	 */
	static containsPath(rootPath: string, targetPath: string): boolean {
		const normalizedRoot = ClientRegistry.normalizePath(rootPath);
		const normalizedTarget = ClientRegistry.normalizePath(targetPath);
		const rel = relative(normalizedRoot, normalizedTarget);

		return (
			rel === "" ||
			(!rel.startsWith("..") && rel !== "." && !isAbsolute(rel))
		);
	}
}
