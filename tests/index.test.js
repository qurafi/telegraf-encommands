const { Context } = require("telegraf");
const { setupBot, setupTest, ignoreBotToken, sendCommand } = require("./helper");
const { test_messages } = require("./samples");
require("dotenv").config();

const supported_subtypes = ["audio", "voice", "video", "photo", "document", "sticker"];

for (const subtype of supported_subtypes) {
	test_messages.push({
		name: `callback should be called on the supported sub-type: "${subtype}"`,
		message: { subType: subtype },
	});
}

for (const test of test_messages) {
	setupTest(test);
}


it("verify callback parameters", done => {
	const { bot, commands, sendCommand } = setupBot(done);
	commands.on("test", params => {
		expect(params.ctx).toBeInstanceOf(Context);
		expect(params.command).toEqual("test");
		expect(params.query).toEqual("arg1 arg2 arg3");
		expect(params.args).toContain("arg1");
		expect(params.args).toHaveLength(3);
		expect(params.message).toHaveProperty("chat");
		expect(params.message).toHaveProperty("from");
		expect(params.type).toEqual("text");
		done();
	});

	ignoreBotToken(bot, done);

	bot.on("message", () => {
		throw Error("should not call next()");
	});

	sendCommand("test", "arg1 arg2 arg3");
});

it("should not call handler when not sending command", done => {
    const { bot, commands, sendMessage } = setupBot(done);
	commands.on("test", params => {
		throw Error("should not call command handler");
	});

	ignoreBotToken(bot, done);

	bot.on("message", () => {
		done()
	});

	sendMessage("test arg1 arg2 arg3");
})


it("should not be called when providing empty message object", done => {
    const { bot, commands, sendMessage } = setupBot(done);

	bot.on("message", () => {
		done();
	});

    bot.handleUpdate({
        message: {
        }
    })
})


it("should return help message", done => {
    const { bot, commands, sendCommand } = setupBot(done, {
        required: true,
        helpMessage: "help",
    });

	ignoreBotToken(bot, done);


	commands.on("test", params => {
        throw Error("should not call command handler");
	});

	bot.on("message", (ctx) => {
        expect(ctx.message.text).toEqual("help")
		done()
	});

	sendCommand("test", "");
})
