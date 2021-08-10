const { Telegraf } = require("telegraf");
const { TelegrafEncommands } = require("../lib/index");
const defaultConfigs = {
	required: true,
	helpMessage: "this is a help message",
	mode: "private",
	allowedUsers: ["telegraf"],
	replyCacheAge: 3,
};

// copied from: https://github.com/telegraf/telegraf/blob/develop/test/composer.js
const baseMessage = { chat: { id: 1 }, from: { id: 42, username: "telegraf" } };
const baseGroupMessage = {
	chat: { id: -1, type: "group" },
	from: { id: 42, username: "telegraf" },
};

// HACK: bot token required means that the message has been sent successfully
function ignoreBotToken(bot, done) {
	bot.catch(e => {
		done(e.code !== 401 && e);
	});
}

function setupBot(done, configs = defaultConfigs) {
	const bot = new Telegraf();
	bot.botInfo = { id: 42, is_bot: true, username: "bot", first_name: "Bot" };

	const commands = TelegrafEncommands({
		...configs,
	});

	bot.use(commands.middleware);

	return { bot, commands, sendCommand: sendCommand.bind(bot) };
}

function setupTest({
	name = "",
	shouldRun = true,
	query = "query string",
	target = "private",
	message = {},
	options = {},
	isEdited,
	test: testfn,
}) {
	it(name, done => {
		const { bot, commands, sendCommand } = setupBot(done, {
			...defaultConfigs,
			...options,
		});

		ignoreBotToken(bot, done);

		commands.on("test", params => {
			if (!shouldRun) {
				throw Error("command expected to not run");
			}

			if (testfn) testfn(params);

			done();
		});

		bot.on(isEdited ? "edited_message" : "message", () => {
			if (shouldRun) {
				throw Error("next() should not be called");
			} else {
				done();
			}
		});

		sendCommand("test", query, target == "group", message, isEdited);
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

module.exports = {
	ignoreBotToken,
	setupBot,
	setupTest,
	sendCommand,
};
