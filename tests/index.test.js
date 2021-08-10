const { Context } = require("telegraf");
const { setupBot, setupTest, ignoreBotToken, sendCommand } = require("./helper");

require("dotenv").config();

const supportedUpdateSubTypes = ["audio", "voice", "video", "photo", "document", "sticker"];

const tests = [
	{
		name: "callback should be called if query is specified",
	},
	{
		name: "callback should not be called if query is empty",
		shouldRun: false,
		query: "",

		options: {
			required: true,
			helpMessage: false,
		},
	},
	{
		name: "callback should be called only on private chat",
		shouldRun: false,
		target: "group",
	},
	{
		name: "callback should be called only on group chat",
		shouldRun: false,
		target: "private",
		options: {
			mode: "group",
		},
	},
	{
		name: "callback should be called on both chat modes",
		target: "group",
		options: {
			mode: "both",
		},
	},
	{
		name: "callback should be called only on allowed users",
		shouldRun: false,
		options: {
			allowedUsers: ["telegraf2"],
		},
	},

	{
		name: "callback should not be called only on targeted sub-types",
		shouldRun: false,
		message: { subType: "photo" },
		options: {
			subTypes: ["video"],
		},
	},

	{
		name: "should use replied_to_message as query when userReply = true",
		query: "",
		message: {
			reply_to_message: {
				text: "hello world",
				entities: [],
			},
		},

		options: {
			required: true,
			useReply: true,
		},

		test: params => {
			expect(params.query).toEqual("hello world");
		},
	},
	{
		name: "callback should be called on replied messages",
		query: "",
		message: {
			reply_to_message: {
				text: "hello test",
				entities: [],
			},
		},

		options: {
			required: false,
		},
	},

	{
		name: "callback should be called on edited messages when allowEdited = true",
		isEdited: true,

		options: {
			allowEdited: true,
		},
	},

	{
		name: "callback should be called on edited messages when allowEdited = false",
		query: "edited",
		shouldRun: false,
		isEdited: true,

		options: {
			allowEdited: false,
		},
	},
];

for (const subType of supportedUpdateSubTypes.slice(0, 1)) {
	tests.push({
		name: `callback should be called on the supported sub-type: "${subType}"`,
		message: { subType },
	});
}

for (const test of tests) {
	setupTest(test);
}

it("verify callback paramters", done => {
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
