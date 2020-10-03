export interface parserOptions {
	maxargs?: number;

	// remove duplicated args
	removeDups?: boolean;

	// used to pre-filter the raw query
	// should return string
	preParse?: Function;

	// used to filter the parsed arguments list
	// should return array
	postParse?: Function;
}

export function parseArgs(query: string, options: parserOptions = {}) {
	if (options.preParse) {
		let returned = options.preParse(query);
		if (typeof returned == "string") {
			query = returned;
		}
	}

	let queries = query.trim().split(" ", options.maxargs);

	if (options.postParse) {
		let returned = options.postParse(query);
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
