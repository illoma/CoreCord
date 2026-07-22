/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";

const EIGHTBALL = [
    "It is certain.", "Without a doubt.", "Yes, definitely.", "You may rely on it.",
    "Most likely.", "Outlook good.", "Signs point to yes.", "Reply hazy, try again.",
    "Ask again later.", "Cannot predict now.", "Don't count on it.", "My reply is no.",
    "Very doubtful.", "Outlook not so good.", "Absolutely not."
];

function mock(text: string) {
    return [...text].map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join("");
}

export default definePlugin({
    name: "CoreUtilities",
    description: "Handy slash commands: /roll, /flip, /eightball, /choose, /reverse, /mock.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Utility", "Fun", "CoreCord"],
    enabledByDefault: true,

    commands: [
        {
            name: "roll",
            description: "Roll a random number",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "max",
                    description: "Highest possible number (default 100)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: false
                }
            ],
            execute: (args, ctx) => {
                const max = Math.max(1, findOption<number>(args, "max", 100));
                const result = Math.floor(Math.random() * max) + 1;
                sendMessage(ctx.channel.id, { content: `🎲 Rolled **${result}** (1–${max})` });
            }
        },
        {
            name: "flip",
            description: "Flip a coin",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                sendMessage(ctx.channel.id, { content: `🪙 **${Math.random() < 0.5 ? "Heads" : "Tails"}**` });
            }
        },
        {
            name: "eightball",
            description: "Ask the magic 8-ball a question",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "question",
                    description: "Your yes/no question",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const question = findOption<string>(args, "question", "");
                const answer = EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)];
                sendMessage(ctx.channel.id, { content: `🎱 **Q:** ${question}\n**A:** ${answer}` });
            }
        },
        {
            name: "choose",
            description: "Let CoreCord pick one option for you",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "options",
                    description: "Options separated by commas (e.g. pizza, sushi, tacos)",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const raw = findOption<string>(args, "options", "");
                const options = raw.split(",").map(o => o.trim()).filter(Boolean);
                if (options.length < 2) {
                    return sendBotMessage(ctx.channel.id, { content: "⚠️ Give me at least two options separated by commas." });
                }
                const pick = options[Math.floor(Math.random() * options.length)];
                sendMessage(ctx.channel.id, { content: `🤔 I choose: **${pick}**` });
            }
        },
        {
            name: "reverse",
            description: "Reverse some text",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "text",
                    description: "Text to reverse",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const text = findOption<string>(args, "text", "");
                sendMessage(ctx.channel.id, { content: [...text].reverse().join("") });
            }
        },
        {
            name: "mock",
            description: "sPoNgEbOb-CaSe some text",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "text",
                    description: "Text to mock",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const text = findOption<string>(args, "text", "");
                sendMessage(ctx.channel.id, { content: mock(text) });
            }
        }
    ]
});
