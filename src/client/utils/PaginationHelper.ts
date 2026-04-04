import Config from "../Config";
import { StringBuilder } from "./StringBuilder";

const DEFAULT_PAGE_SIZE = Config.getPageSize();

function paginate<T>(
	items: T[],
	page: number = 1,
	pageSize: number = DEFAULT_PAGE_SIZE,
): {
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
		hasMore: currentPage < totalPages,
	};
}

function appendHeader(
	sb: StringBuilder,
	title: string,
	page: number,
	totalPages: number,
	totalItems: number,
): void {
	sb.appendLine(`## ${title}`);
	sb.appendLine();
	sb.appendLine(`> Page ${page}/${totalPages} | Total: ${totalItems} items`);
	sb.appendLine();
}

function appendFooter(sb: StringBuilder, page: number, hasMore: boolean): void {
	if (hasMore) {
		sb.appendLine();
		sb.appendLine("---");
		sb.appendLine(
			`*More results available. Request page ${page + 1} to continue.*`,
		);
	}
}

function wrapPaginated(
	title: string,
	page: number,
	totalPages: number,
	totalItems: number,
	hasMore: boolean,
	contentBuilder: (sb: StringBuilder) => void,
): string {
	const sb = new StringBuilder();
	appendHeader(sb, title, page, totalPages, totalItems);
	contentBuilder(sb);
	appendFooter(sb, page, hasMore);
	return sb.toString();
}

export const PaginationHelper = {
	DEFAULT_PAGE_SIZE,
	paginate,
	appendHeader,
	appendFooter,
	wrapPaginated,
};
