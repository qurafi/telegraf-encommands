const { InvalidCommand } = require("../lib");

exports.test_messages = [
	{
		name: "callback should be called if query is specified",
        shouldRun: true,
        options: {
            required: false,
        },
	},
	{
		name: "callback should not be called if query is empty",
		shouldRun: false,
        shouldInvalid: true,
		query: "",

		options: {
			required: true,
			helpMessage: undefined,
		},
	},
	{
		name: "callback should be called only on private chat",
        shouldInvalid: true,
		shouldRun: false,
		target: "group",
	},
	{
		name: "callback should be called only on group chat",
		shouldRun: false,
        shouldInvalid: true,
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
        shouldInvalid: true,
		options: {
			allowedUsers: ["telegraf2"],
		},
	},

	{
		name: "callback should not be called only on targeted sub-types",
		shouldRun: false,
        shouldInvalid: true,
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
				text: "replied_to",
				entities: [],
			},
		},

		options: {
			required: true,
			useRepliedTo: true,
		},

		test: params => {
			expect(params.query).toEqual("replied_to");
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

        test: params => {
			expect(params.query).toEqual("");

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
