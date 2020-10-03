require("dotenv").config();
const Telegraf = require("telegraf");
const CommandManager = require("../lib/index");

const supportedUpdateSubTypes = ["audio", "voice", "video", "photo", "document", "sticker"];
const defaultConfigs = {
	required: true,
	helpMessage: "this is a help message",
	mode: "private",
	allowedUsers: ["telegraf"],
};

// copied from: https://github.com/telegraf/telegraf/blob/develop/test/composer.js
const baseMessage = { chat: { id: 1 }, from: { id: 42, username: "telegraf" } };
const baseGroupMessage = {
	chat: { id: -1, type: "group" },
	from: { id: 42, username: "telegraf" },
};

const tests = [
	{
		name: "callback should be called if query is specified",
		cb_done: true,
		whenNext: false,
	},
	{
		name: "callback should not be called if query is empty",
		whenNext: true,
		query: "",
		notExcept: true,

		options: {
			required: true,
		},
	},
	{
		name: "callback should be called only on private chat",
		whenNext: true,
		notExcept: true,
		target: "group",
	},
	{
		name: "callback should be called only on group chat",
		whenNext: true,
		notExcept: true,
		target: "private",
		options: {
			mode: "group",
		},
	},
	{
		name: "callback should be called on both chat modes",
		cb_done: true,
		whenNext: false,
		target: "group",
		options: {
			mode: "both",
		},
	},
	{
		name: "callback should be called only on allowed users",
		whenNext: true,
		notExcept: true,
		options: {
			allowedUsers: ["telegraf2"],
		},
	},

	{
		name: "callback should not be called only on targeted sub-types",
		whenNext: true,
		notExcept: true,
		message: { subType: "photo" },
		options: {
			subTypes: ["video"],
		},
	},

	{
		name: "callback should be called on replied messages",
		cb_done: true,
		whenNext: false,
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
	},
	{
		name: "callback should be called on replied messages",
		cb_done: true,
		whenNext: false,
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
		name: "callback should be called on edited messages",
		cb_done: true,
		whenNext: false,
		isEditied: true,
		message: {
			editedMessage: {
				text: "hello world",
				entities: [],
			},
		},

		options: {
			allowEdited: true,
		},
	},
];

function setupBot(done, config = defaultConfigs) {
	const bot = new Telegraf();
	const commands = new CommandManager();
	commands.configs = { ...config };
	bot.use(commands.middleware);

	bot.catch(e => {
		// HACK: bot token required means that the message has been sent successfully
		done(e.code !== 401 && e);
	});

	return { bot, commands, sendCommand: sendCommand.bind(bot) };
}

function setupTest({
	name = "",
	cb_done,
	query = "query string",
	notExcept,
	whenNext,
	target = "private",
	message = {},
	options = {},
	isEditied,
}) {
	it(name, async done => {
		try {
			const { bot, commands, sendCommand } = setupBot(done, { ...defaultConfigs, ...options });

			let callback = jest.fn(() => cb_done && done());
			commands.on("test", callback);
			if (whenNext !== undefined) doIfNext(bot, whenNext && done);

			await sendCommand("test", query, target == "group", message, isEditied);

			let ex = expect(callback);
			if (notExcept) ex = ex.not;
			ex.toHaveBeenCalled();
		} catch (e) {
			done(e);
		}
	});
}

function sendCommand(command, query = "", target, other_options = {}, isEdited) {
	let subType = other_options.subType;
	if (subType) {
		other_options[subType] = {};
	}

	let text = subType ? "caption" : "text";
	let entities = subType ? "caption_entities" : "entities";
	let message = {
		[text]: `/${command} ${query}`,
		[entities]: [{ type: "bot_command", offset: 0, length: command.length + 1 }],
		...(target ? baseGroupMessage : baseMessage),
		...other_options,
	};

	return this.handleUpdate({ [isEdited ? "edited_message" : "message"]: message });
}

function doIfNext(bot, ac) {
	bot.on("message", () => {
		if (ac === false) throw new Error("should not return next()");
		if (typeof ac == "function") ac();
	});
}

for (const subType of supportedUpdateSubTypes) {
	tests.push({
		name: `callback should be called on the supported sub-type: "${subType}"`,
		cb_done: true,
		whenNext: false,
		message: { subType },
	});
}

// .slice(-1)
// setupTest(tests[4]);

for (const test of tests) {
	setupTest(test);
}

it("verify callback paramters", async done => {
	const { bot, commands, sendCommand } = setupBot(done);
	let callback = jest.fn(params => {
		expect(params.ctx).toBeInstanceOf(Telegraf.Context);
		expect(params.command).toEqual("test");
		expect(params.query).toEqual("arg1 arg2 arg3");
		expect(params.args).toContain("arg1");
		expect(params.args).toHaveLength(3);
		expect(params.message).toHaveProperty("chat");
		expect(params.message).toHaveProperty("from");
		expect(params.updateType).toEqual("text");
		done();
	});
	commands.on("test", callback);
	doIfNext(bot, false);
	await sendCommand("test", "arg1 arg2 arg3");
	expect(callback).toHaveBeenCalled();
});
