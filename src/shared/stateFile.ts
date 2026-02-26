/**
 * 状态文件读写
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import * as path from 'path';
import { ServerState, ServerStateFlag, ServerStateData, StateUtils } from './types';
import { SERVER_STATE_FILE } from './constants';

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
      const content = await readFile(this.filePath, 'utf-8');
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

  /**
   * 写入进程已启动状态
   */
  async writeStarting(port: number): Promise<void> {
    await this.write({
      state: ServerState.STARTING,
      port,
      pid: process.pid,
      startTime: Date.now()
    });
  }
  /**
   * 写入运行中状态
   */
  async writeRunning(port: number): Promise<void> {
    await this.write({
      state: ServerState.RUNNING,
      port,
      pid: process.pid,
      startTime: Date.now()
    });
  }
  /**
   * 写入重启中状态
   */
  async writeRestarting(port: number): Promise<void> {
    await this.write({
      state: ServerState.RESTARTING,
      port,
      pid: process.pid,
      startTime: Date.now()
    });
  }
  /**
   * 写入已关闭状态
   */
  async writeStopped(port: number): Promise<void> {
    await this.write({
      state: ServerState.STOPPED,
      port,
      pid: process.pid,
      startTime: Date.now()
    });
  }
  /**
   * 写入端口冲突错误
   */
  async writePortConflict(port:number,rawState: ServerStateData|null, errorMessage?: string): Promise<void> {
    if(rawState){
      const s=StateUtils.clearError(rawState.state);
      rawState={
        ...rawState,
        state: ServerState.ERROR_PORT_CONFLICT|s,
        errorMessage
      };
    }
    else{
      rawState={
        state: ServerState.ERROR_PORT_CONFLICT,
        errorMessage,
        port,
        pid: process.pid,
        startTime: Date.now()
      };
    }
    await this.write(rawState);
  }
  /**
   * 写入服务器已运行错误
   */
  async writeAlreadyRunning(rawState: ServerStateData): Promise<void> {
    const s=StateUtils.clearError(rawState.state);
    await this.write({
      ...rawState,
      state: ServerState.ERROR_ALREADY_RUNNING|s,
    });
  }
  /**
   * 写入未知错误
   */
  async writeError(port:number,rawState: ServerStateData|null, errorMessage?: string): Promise<void> {
    if(rawState){
      const s=StateUtils.clearError(rawState.state);
      rawState={
        ...rawState,
        state: ServerState.ERROR_UNKNOWN|s,
        errorMessage
      };
    }
    else{
      rawState={
        state: ServerState.ERROR_UNKNOWN,
        errorMessage,
        port,
        pid: process.pid,
        startTime: Date.now()
      };
    }
  }
}
