const { parseArgs } = require("../lib/args");

it("test parseArgs", () => {
	let mock = jest.fn();
	let args = parseArgs("test query test test", {
		removeDups: true,
		preParse: mock,
		postParse: mock,
	});

	expect(args).toEqual(["test", "query"]);
	expect(mock).toBeCalledTimes(2);
});
