"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = void 0;
function parseArgs(query, options = {}) {
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
exports.parseArgs = parseArgs;
//# sourceMappingURL=args.js.map