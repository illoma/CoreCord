/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import definePlugin from "@utils/types";

const STORE_KEY = "CoreCord_Notes";

async function getNotes(): Promise<string[]> {
    return (await DataStore.get<string[]>(STORE_KEY)) ?? [];
}
async function setNotes(notes: string[]) {
    await DataStore.set(STORE_KEY, notes);
}

export default definePlugin({
    name: "QuickNotes",
    description: "A private, persistent scratchpad. Save quick notes with /note — only you ever see them.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Utility", "CoreCord"],
    enabledByDefault: true,

    commands: [
        {
            name: "note",
            description: "Manage your private notes",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "add",
                    description: "Add a note",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "text",
                            description: "The note to save",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Show all your notes",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: []
                },
                {
                    name: "remove",
                    description: "Remove a note by its number",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "number",
                            description: "The note number (see /note list)",
                            type: ApplicationCommandOptionType.INTEGER,
                            required: true
                        }
                    ]
                },
                {
                    name: "clear",
                    description: "Delete all notes",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: []
                }
            ],
            execute: async (args, ctx) => {
                const sub = args[0];
                const notes = await getNotes();

                switch (sub.name) {
                    case "add": {
                        const text = findOption<string>(sub.options, "text", "");
                        notes.push(text);
                        await setNotes(notes);
                        return sendBotMessage(ctx.channel.id, { content: `📝 Saved as note **#${notes.length}**.` });
                    }
                    case "list": {
                        if (!notes.length) return sendBotMessage(ctx.channel.id, { content: "You have no notes yet. Add one with `/note add`." });
                        const list = notes.map((n, i) => `**${i + 1}.** ${n}`).join("\n");
                        return sendBotMessage(ctx.channel.id, { content: `**Your notes:**\n${list}` });
                    }
                    case "remove": {
                        const n = findOption<number>(sub.options, "number", 0);
                        if (n < 1 || n > notes.length) return sendBotMessage(ctx.channel.id, { content: `⚠️ No note **#${n}**.` });
                        const [removed] = notes.splice(n - 1, 1);
                        await setNotes(notes);
                        return sendBotMessage(ctx.channel.id, { content: `🗑️ Removed note **#${n}**: ${removed}` });
                    }
                    case "clear": {
                        await setNotes([]);
                        return sendBotMessage(ctx.channel.id, { content: "🧹 All notes cleared." });
                    }
                }
            }
        }
    ]
});
