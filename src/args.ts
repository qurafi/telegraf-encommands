export interface parserOptions {
	maxargs?: number;

	// remove duplicated args
	removeDups?: boolean;

	// used to pre-filter the raw query
	// should return string
	preParse?: (v: string) => string;

	// used to filter the parsed arguments list
	// should return array
	postParse?: (v: string[]) => string[];
}

export function parseArgs(query: string, options: parserOptions = {}): string[] {
	if (options.preParse) {
		const returned = options.preParse(query);
		if (typeof returned == "string") {
			query = returned;
		}
	}

	let queries = query.trim().split(" ", options.maxargs);

	if (options.postParse) {
		const returned = options.postParse(queries);
		if (Array.isArray(returned)) {
			queries = returned;
		}
	}

	// remove any empty string
	queries = queries.filter(Boolean);

	if (options.removeDups) {
		queries = [...new Set(queries)];
	}

	return queries;
}
