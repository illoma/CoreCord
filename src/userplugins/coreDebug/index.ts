/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import { findByProps, search, wreq } from "@webpack";
import { UserProfileStore, UserStore } from "@webpack/common";
import { SYM_PATCHED_BY } from "../../webpack/patchWebpack";

/** Describes an object's own keys with a short, circular-safe preview of each value. */
function describe(obj: any): string {
    if (obj == null) return "(null)";
    return Object.keys(obj)
        .sort()
        .map(key => {
            let value: any;
            try {
                value = obj[key];
            } catch {
                return `${key}: <threw>`;
            }
            if (typeof value === "function") return `${key}: <fn>`;
            if (value == null) return `${key}: ${String(value)}`;
            if (typeof value === "object") {
                try {
                    return `${key}: ${JSON.stringify(value).slice(0, 200)}`;
                } catch {
                    return `${key}: <object>`;
                }
            }
            return `${key}: ${String(value).slice(0, 120)}`;
        })
        .join("\n");
}

// Developer helper: lets you pull a chunk of Discord's own bundled source straight
// into your clipboard, without needing DevTools. Handy for writing patches.

export default definePlugin({
    name: "CoreDebug",
    description: "Developer helper: copy Discord's internal module source to your clipboard with /ccdump.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Utility", "CoreCord"],
    enabledByDefault: true,

    commands: [
        {
            name: "ccfind",
            description: "Find a Discord module by prop names and list what's on it",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "props",
                    description: "Comma-separated prop names the module must have",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "call",
                    description: "Also call these functions (comma-separated) with your user and show what they return",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                },
                {
                    name: "filter",
                    description: "Only list keys containing this text",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                }
            ],
            execute: (args, ctx) => {
                const props = findOption<string>(args, "props", "")
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean);

                if (!props.length) {
                    return sendBotMessage(ctx.channel.id, { content: "❌ Give me at least one prop name." });
                }

                let mod: any;
                try {
                    mod = findByProps(...props);
                } catch (err) {
                    return sendBotMessage(ctx.channel.id, { content: `❌ Lookup threw: \`${String(err)}\`` });
                }

                if (!mod) {
                    return sendBotMessage(ctx.channel.id, {
                        content: `❌ **No module** has all of \`${props.join(", ")}\`.\nThe name may be wrong, or the chunk isn't loaded yet — open the relevant UI once and retry.`
                    });
                }

                const keyFilter = findOption<string>(args, "filter", "").toLowerCase();
                const keys = Object.keys(mod)
                    .filter(k => !keyFilter || k.toLowerCase().includes(keyFilter))
                    .sort();

                const detail = keys
                    .map(k => {
                        let t = "?";
                        try {
                            t = typeof mod[k];
                        } catch { /* getter threw */ }
                        return `${k}: ${t}`;
                    })
                    .join("\n");

                // Calling the gates is the only way to know whether a patch really took.
                const toCall = findOption<string>(args, "call", "")
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean);

                const results = toCall.map(name => {
                    try {
                        const fn = mod[name];
                        if (typeof fn !== "function") return `${name}: <not a function>`;
                        return `${name}() => ${String(fn(UserStore?.getCurrentUser()))}`;
                    } catch (err) {
                        return `${name}: threw ${String(err).slice(0, 80)}`;
                    }
                });

                copyToClipboard([results.join("\n"), detail].filter(Boolean).join("\n\n"));

                return sendBotMessage(ctx.channel.id, {
                    content: [
                        `✅ **Found** a module with \`${props.join(", ")}\` — ${keys.length} key(s) listed (all copied to clipboard).`,
                        results.length ? `\n**Calls:**\n\`\`\`\n${results.join("\n").slice(0, 700)}\n\`\`\`` : "",
                        `\n\`\`\`\n${detail.slice(0, 900)}\n\`\`\``
                    ].filter(Boolean).join("")
                });
            }
        },
        {
            name: "ccprofile",
            description: "Copy your own user + profile objects to the clipboard (for debugging)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "user-id",
                    description: "Inspect someone else instead of yourself",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                }
            ],
            execute: (args, ctx) => {
                const me = UserStore?.getCurrentUser();
                const targetId = findOption<string>(args, "user-id", "") || me?.id;

                if (!targetId) {
                    return sendBotMessage(ctx.channel.id, { content: "❌ Couldn't work out whose profile to read." });
                }

                const user: any = UserStore?.getUser(targetId);
                const profile: any = UserProfileStore?.getUserProfile(targetId);

                const dump = [
                    `===== USER (${targetId}) =====`,
                    describe(user),
                    "",
                    "===== PROFILE =====",
                    describe(profile)
                ].join("\n");

                copyToClipboard(dump);

                return sendBotMessage(ctx.channel.id, {
                    content: `✅ Copied **${dump.length}** chars.\n> user keys: ${user ? Object.keys(user).length : 0} · profile keys: ${profile ? Object.keys(profile).length : 0}${profile ? "" : "\n> ⚠️ profile is empty — open the profile once so Discord fetches it, then retry"}`
                });
            }
        },
        {
            name: "ccpatches",
            description: "List which plugin patches actually applied (and to which module)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "plugin",
                    description: "Only show patches from plugins whose name contains this",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                }
            ],
            execute: (args, ctx) => {
                const filter = findOption<string>(args, "plugin", "").toLowerCase();

                // Every factory Vencord actually patched carries the set of plugins that
                // touched it, so this reflects reality in a normal (non-reporter) build.
                const byPlugin = new Map<string, string[]>();
                const factories = (wreq as any)?.m ?? {};

                for (const moduleId in factories) {
                    const plugins: Set<string> | undefined = factories[moduleId]?.[SYM_PATCHED_BY];
                    if (!plugins) continue;
                    for (const plugin of plugins) {
                        if (filter && !plugin.toLowerCase().includes(filter)) continue;
                        if (!byPlugin.has(plugin)) byPlugin.set(plugin, []);
                        byPlugin.get(plugin)!.push(String(moduleId));
                    }
                }

                if (!byPlugin.size) {
                    return sendBotMessage(ctx.channel.id, {
                        content: filter
                            ? `❌ **Nothing patched** by a plugin matching \`${filter}\`.\nEither it's disabled, you didn't reload after enabling it, or its \`find\` strings matched no module.`
                            : "❌ No patched modules found at all."
                    });
                }

                const text = [...byPlugin.entries()]
                    .map(([plugin, ids]) => `\`${plugin}\` → ${ids.length} module(s): \`${ids.join(", ")}\``)
                    .join("\n");

                copyToClipboard(text);

                return sendBotMessage(ctx.channel.id, {
                    content: `✅ Patched modules${filter ? ` matching \`${filter}\`` : ""} (copied to clipboard):\n\n${text.slice(0, 1500)}`
                });
            }
        },
        {
            name: "ccdump",
            description: "Copy a slice of Discord's internal source to your clipboard",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "find",
                    description: "A string that only appears in the module you want",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "around",
                    description: "Centre the excerpt on this keyword (optional)",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                },
                {
                    name: "chars",
                    description: "Characters of context on each side (default 1500)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: false
                },
                {
                    name: "index",
                    description: "Which matching module to use, if several matched (default 0)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: false
                },
                {
                    name: "all",
                    description: "Dump an excerpt from every matching module instead of just one",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],
            execute: (args, ctx) => {
                const needle = findOption<string>(args, "find", "");
                const around = findOption<string>(args, "around", "");
                const chars = findOption<number>(args, "chars", 1500);
                const index = findOption<number>(args, "index", 0);
                const all = findOption<boolean>(args, "all", false);

                let results: Record<string, Function>;
                try {
                    results = search(needle) as any;
                } catch (err) {
                    return sendBotMessage(ctx.channel.id, { content: `❌ Search failed: \`${String(err)}\`` });
                }

                const ids = Object.keys(results);
                if (!ids.length) {
                    return sendBotMessage(ctx.channel.id, {
                        content: `❌ No module contains \`${needle}\`.\nIf it lives in a lazy chunk, open the relevant Discord UI once first, then retry.`
                    });
                }

                /** Slice `src` around `around`, or from the start when it isn't there. */
                function excerptOf(src: string) {
                    if (!around) return src.slice(0, chars * 2);
                    const at = src.indexOf(around);
                    return at >= 0
                        ? src.slice(Math.max(0, at - chars), at + chars)
                        : src.slice(0, chars);
                }

                if (all) {
                    const capped = ids.slice(0, 12);
                    const dump = capped
                        .map(id => {
                            const src = String(results[id]);
                            return `===== module ${id} (${src.length} chars) =====\n${excerptOf(src)}`;
                        })
                        .join("\n\n");

                    copyToClipboard(dump);
                    return sendBotMessage(ctx.channel.id, {
                        content: [
                            `✅ Copied **${dump.length}** chars from **${capped.length}** module(s).`,
                            `> matched \`${needle}\` in: \`${ids.join(", ")}\``,
                            ids.length > capped.length ? `> (capped at 12 — raise \`chars\` down or narrow \`find\`)` : ""
                        ].filter(Boolean).join("\n")
                    });
                }

                const id = ids[Math.min(Math.max(index, 0), ids.length - 1)];
                const source = String(results[id]);

                let excerpt = source;
                let at = -1;
                if (around) {
                    at = source.indexOf(around);
                    if (at >= 0) {
                        excerpt = source.slice(Math.max(0, at - chars), at + chars);
                    }
                }

                copyToClipboard(excerpt);

                sendBotMessage(ctx.channel.id, {
                    content: [
                        `✅ Copied **${excerpt.length}** chars to your clipboard.`,
                        `> module \`${id}\` — ${ids.length} module(s) matched \`${needle}\``,
                        `> full source: ${source.length} chars` + (around ? ` · \`${around}\` ${at >= 0 ? `found at ${at}` : "**not found** (copied from the start)"}` : ""),
                        ids.length > 1 ? `> other modules: \`${ids.slice(0, 8).join(", ")}\` — use \`index:\` to pick another` : ""
                    ].filter(Boolean).join("\n")
                });
            }
        }
    ]
});
