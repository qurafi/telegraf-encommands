const { parseArgs } = require("../lib/args");


describe("parseArgs", () => {
    test("parseArgs with default options", () => {
        const args = parseArgs("test query test");
        
        expect(args).toEqual(["test", "query", "test"]);
    });

    test("parseArgs with removeDups", () => {
        const args = parseArgs("test query test test", {
            removeDups: true,
        });
        
        expect(args).toEqual(["test", "query"]);
    });

    test("parseArgs with custom preParse", () => {
        const mockedPreParse = jest.fn(v => v);
        const args = parseArgs("test query", {
            preParse: mockedPreParse
        });
        expect(mockedPreParse).toBeCalledTimes(1);
        expect(args).toEqual(["test", "query"]);
    })

    test("parseArgs with custom postParse", () => {
        const mockedPostParse = jest.fn(v => v);
        const args = parseArgs("test query", {
            postParse: mockedPostParse
        });
        expect(mockedPostParse).toBeCalledTimes(1);
        expect(args).toEqual(["test", "query"]);
    })

})
