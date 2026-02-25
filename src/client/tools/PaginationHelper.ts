import { StringBuilder } from './StringBuilder';

/**
 * 分页助手 - 统一添加分页头和分页尾
 */
export class PaginationHelper {
  /** 默认每页条数 */
  static readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * 对数组进行分页
   */
  static paginate<T>(items: T[], page: number = 1, pageSize: number = PaginationHelper.DEFAULT_PAGE_SIZE): {
    items: T[];
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  } {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: items.slice(start, end),
      page: currentPage,
      pageSize,
      totalPages,
      totalItems,
      hasMore: currentPage < totalPages
    };
  }

  /**
   * 添加分页头
   */
  static appendHeader(sb: StringBuilder, title: string, page: number, totalPages: number, totalItems: number): void {
    sb.appendLine(`## ${title}`);
    sb.appendLine();
    sb.appendLine(`> Page ${page}/${totalPages} | Total: ${totalItems} items`);
    sb.appendLine();
  }

  /**
   * 添加分页尾
   */
  static appendFooter(sb: StringBuilder, page: number, totalPages: number, hasMore: boolean): void {
    sb.appendLine();
    sb.appendLine('---');
    if (hasMore) {
      sb.appendLine(`*More results available. Request page ${page + 1} to continue.*`);
    } else {
      sb.appendLine(`*End of results (Page ${page}/${totalPages})*`);
    }
  }

  /**
   * 包装分页内容（头 + 内容 + 尾）
   */
  static wrapPaginated(
    title: string,
    page: number,
    totalPages: number,
    totalItems: number,
    hasMore: boolean,
    contentBuilder: (sb: StringBuilder) => void
  ): string {
    const sb = new StringBuilder();
    this.appendHeader(sb, title, page, totalPages, totalItems);
    contentBuilder(sb);
    this.appendFooter(sb, page, totalPages, hasMore);
    return sb.toString();
  }
}
