export interface parserOptions {
	maxargs?: number;

	/** Remove duplicated args */
	removeDups?: boolean;

	/** Used to pre-filter the raw query */
	preParse?: (v: string) => string;

	//** Used to filter the parsed arguments list */
	postParse?: (v: string[]) => string[];
}

export function parseArgs(query: string, options: parserOptions = {}): string[] {
	if (options.preParse) {
		const returned = options.preParse(query);
		if (typeof returned != "string") {
			throw new TypeError("expected preParse result to be string");
		}

		query = returned;
	}

	let queries = query.trim().split(" ", options.maxargs);

	if (options.postParse) {
		const returned = options.postParse(queries);
		if (!Array.isArray(returned)) {
			throw new TypeError("expected postParse result to be array");
		}
		queries = returned;
	}

	// remove any empty string
	queries = queries.filter(Boolean);

	if (options.removeDups) {
		queries = [...new Set(queries)];
	}

	return queries;
}
