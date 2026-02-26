/**
 * 客户端注册表 - 管理所有连接的 VSCode 窗口
 */

import type { WebSocket } from "ws";
import type { Folder, ProjectInfo } from "../shared/types";
import { normalize, resolve } from "path";

/** 客户端信息 */
export interface ClientInfo {
  ws: WebSocket;
  windowId: string;
  folders: Folder[];
  connectedAt: number;
}

export class ClientRegistry {
  private clients = new Map<string, ClientInfo>();
  private projectIndex = new Map<string, string>(); // projectPath -> windowId

  /**
   * 注册窗口
   */
  register(windowId: string, ws: WebSocket, folders: Folder[]): void {
    //格式化路径
    folders=folders.map(f => {
      f.path=ClientRegistry.normalizePath(f.path);
      return f;
    });
    this.clients.set(windowId, {
      ws,
      windowId,
      folders,
      connectedAt: Date.now(),
    });

    // 建立 projectPath 索引
    for (const folder of folders) {
      this.projectIndex.set(
        folder.path,
        windowId
      );
    }

    console.log(
      `[Registry] Window ${windowId} registered with ${folders.length} folders`
    );
  }

  /**
   * 注销窗口
   */
  unregister(windowId: string): void {
    const client = this.clients.get(windowId);
    if (client) {
      // 清理 projectPath 索引
      for (const folder of client.folders) {
        this.projectIndex.delete(folder.path);
      }
      this.clients.delete(windowId);
      console.log(`[Registry] Window ${windowId} unregistered`);
    }
  }

  /**
   * 根据项目路径查找客户端
   */
  findByProjectPath(projectPath: string): ClientInfo | undefined {
    const normalized = ClientRegistry.normalizePath(projectPath);
    const windowId = this.projectIndex.get(normalized);
    return windowId ? this.clients.get(windowId) : undefined;
  }

  /**
   * 获取所有项目列表
   */
  getAllProjects(): ProjectInfo[] {
    const result: ProjectInfo[] = [];
    for (const client of this.clients.values()) {
      for (const folder of client.folders) {
        result.push({ ...folder, windowId: client.windowId });
      }
    }
    return result;
  }

  /**
   * 获取所有客户端
   */
  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * 客户端数量
   */
  get size(): number {
    return this.clients.size;
  }

  /**
   * 路径标准化
   */
  static normalizePath(p: string): string {
    let normalized=normalize(resolve(p));
    // 3. Windows 盘符统一大写
    if (process.platform === 'win32') {
        normalized = normalized.replace(/^([a-zA-Z]):/, (match, drive) => {
            return drive.toUpperCase() + ':';
        });
    }
    return normalized;
  }
}
