/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
*/

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { gitHash, gitRemote } from "@shared/vencordUserAgent";
import definePlugin, { OptionType } from "@utils/types";
import { Toasts } from "@webpack/common";

const settings = definePluginSettings({
    startupToast: {
        type: OptionType.BOOLEAN,
        description: "Show a welcome toast when CoreCord finishes loading",
        default: true
    },
    accentColor: {
        type: OptionType.STRING,
        description: "CoreCord accent color (hex)",
        default: "#7B2FBE"
    }
});

export default definePlugin({
    name: "CoreCord",
    description: "Core plugin of your CoreCord build: welcome toast + /corecord info command.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["CoreCord", "Core"],
    enabledByDefault: true,
    settings,

    commands: [
        {
            name: "corecord",
            description: "Show info about your CoreCord build",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                sendBotMessage(ctx.channel.id, {
                    content: [
                        "## CoreCord 💜",
                        `> **Build:** \`${gitHash}\``,
                        gitRemote ? `> **Repo:** <https://github.com/${gitRemote}>` : "",
                        "> Fork of Vencord, customized by illoma."
                    ].filter(Boolean).join("\n")
                });
            }
        }
    ],

    start() {
        if (settings.store.startupToast) {
            Toasts.show({
                message: "CoreCord loaded 💜",
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId(),
                options: {
                    duration: 2500,
                    position: Toasts.Position.BOTTOM
                }
            });
        }
    }
});
