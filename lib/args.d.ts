export interface parserOptions {
    maxargs?: number;
    removeDups?: boolean;
    preParse?: Function;
    postParse?: Function;
}
export declare function parseArgs(query: string, options?: parserOptions): string[];
