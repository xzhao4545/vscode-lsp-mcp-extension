/**
 * StringBuilder - 高效字符串构建工具类
 */
export class StringBuilder {
	private parts: string[] = [];

	/** 追加字符串 */
	append(str: string): this {
		this.parts.push(str);
		return this;
	}

	/** 追加一行（自动添加换行符） */
	appendLine(str: string = ""): this {
		this.parts.push(`${str}\n`);
		return this;
	}

	/** 追加多行 */
	appendLines(lines: string[]): this {
		for (const line of lines) {
			this.appendLine(line);
		}
		return this;
	}

	/** 清空内容 */
	clear(): this {
		this.parts = [];
		return this;
	}

	/** 获取当前长度 */
	get length(): number {
		return this.parts.reduce((sum, p) => sum + p.length, 0);
	}

	/** 是否为空 */
	get isEmpty(): boolean {
		return this.parts.length === 0 || this.length === 0;
	}

	/** 构建最终字符串 */
	toString(): string {
		return this.parts.join("");
	}
}
