/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import definePlugin from "@utils/types";

interface Reminder {
    id: number;
    time: number;
    text: string;
}

const STORE_KEY = "CoreCord_Reminders";
const MAX_TIMEOUT = 2 ** 31 - 1; // setTimeout overflows past this

let reminders: Reminder[] = [];
const timers = new Map<number, ReturnType<typeof setTimeout>>();

async function save() {
    await DataStore.set(STORE_KEY, reminders);
}

/** Parses strings like "10m", "1h30m", "2d", "45s" into milliseconds. */
function parseDuration(input: string): number | null {
    const re = /(\d+)\s*(d|h|m|s)/gi;
    let ms = 0;
    let matched = false;
    for (const [, amount, unit] of input.matchAll(re)) {
        matched = true;
        const n = parseInt(amount, 10);
        switch (unit.toLowerCase()) {
            case "d": ms += n * 86400000; break;
            case "h": ms += n * 3600000; break;
            case "m": ms += n * 60000; break;
            case "s": ms += n * 1000; break;
        }
    }
    return matched && ms > 0 ? ms : null;
}

function fire(reminder: Reminder) {
    showNotification({
        title: "⏰ CoreCord Reminder",
        body: reminder.text,
        permanent: true
    });
    remove(reminder.id, false);
}

function schedule(reminder: Reminder) {
    const delay = reminder.time - Date.now();
    if (delay <= 0) return fire(reminder);

    // setTimeout can't handle delays larger than ~24.8 days; re-arm in chunks.
    if (delay > MAX_TIMEOUT) {
        timers.set(reminder.id, setTimeout(() => schedule(reminder), MAX_TIMEOUT));
        return;
    }
    timers.set(reminder.id, setTimeout(() => fire(reminder), delay));
}

async function remove(id: number, notify = true) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    reminders = reminders.filter(r => r.id !== id);
    await save();
    return notify;
}

export default definePlugin({
    name: "Reminders",
    description: "Set personal reminders with /remind. They survive restarts and fire a desktop notification.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Utility", "CoreCord"],
    enabledByDefault: true,

    async start() {
        reminders = (await DataStore.get<Reminder[]>(STORE_KEY)) ?? [];
        for (const reminder of [...reminders]) schedule(reminder);
    },

    stop() {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
    },

    commands: [
        {
            name: "remind",
            description: "Set a reminder (e.g. /remind 1h30m Take a break)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "when",
                    description: "Delay, e.g. 45s / 10m / 1h30m / 2d",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "text",
                    description: "What to remind you about",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: async (args, ctx) => {
                const when = findOption<string>(args, "when", "");
                const text = findOption<string>(args, "text", "");
                const ms = parseDuration(when);

                if (ms == null) {
                    return sendBotMessage(ctx.channel.id, {
                        content: "⚠️ Invalid duration. Use formats like `45s`, `10m`, `1h30m`, `2d`."
                    });
                }

                const reminder: Reminder = { id: Date.now(), time: Date.now() + ms, text };
                reminders.push(reminder);
                await save();
                schedule(reminder);

                sendBotMessage(ctx.channel.id, {
                    content: `⏰ Reminder set — I'll ping you <t:${Math.floor(reminder.time / 1000)}:R>:\n> ${text}`
                });
            }
        },
        {
            name: "reminders",
            description: "List your active reminders",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                if (!reminders.length) {
                    return sendBotMessage(ctx.channel.id, { content: "You have no active reminders. Set one with `/remind`." });
                }
                const list = reminders
                    .sort((a, b) => a.time - b.time)
                    .map(r => `\`#${r.id}\` — <t:${Math.floor(r.time / 1000)}:R> — ${r.text}`)
                    .join("\n");
                sendBotMessage(ctx.channel.id, { content: `**Your reminders:**\n${list}\n\nCancel with \`/remind-cancel <id>\`.` });
            }
        },
        {
            name: "remind-cancel",
            description: "Cancel a reminder by its id (see /reminders)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "id",
                    description: "The reminder id",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: async (args, ctx) => {
                const id = parseInt(findOption<string>(args, "id", ""), 10);
                const exists = reminders.some(r => r.id === id);
                await remove(id);
                sendBotMessage(ctx.channel.id, {
                    content: exists ? `🗑️ Cancelled reminder \`#${id}\`.` : `No reminder with id \`#${id}\`.`
                });
            }
        }
    ]
});
