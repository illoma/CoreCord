/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import { search, wreq } from "@webpack";
import { SYM_PATCHED_BY } from "../../webpack/patchWebpack";

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
