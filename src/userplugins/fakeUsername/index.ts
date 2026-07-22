/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. This renames you only on your own client —
// everyone else still sees your real name, and nothing is sent to Discord.
// Your real values are kept so they can be put back when the plugin stops.

const settings = definePluginSettings({
    displayName: {
        type: OptionType.STRING,
        description: "Replace your display name (the big one). Empty to keep the real one.",
        default: "",
        onChange: () => apply()
    },
    username: {
        type: OptionType.STRING,
        description: "Replace your @username. Empty to keep the real one.",
        default: "",
        onChange: () => apply()
    },
    discriminator: {
        type: OptionType.STRING,
        description: "Bring back an old-style tag, e.g. 1337. Empty for none.",
        default: "",
        onChange: () => apply()
    }
});

/** Real values, captured before we overwrite anything. */
const original: { globalName?: string | null; username?: string; discriminator?: string; } = {};
let captured = false;

function capture(user: any) {
    if (captured) return;
    original.globalName = user.globalName;
    original.username = user.username;
    original.discriminator = user.discriminator;
    captured = true;
}

function apply() {
    const user: any = UserStore?.getCurrentUser();
    if (!user) return;

    capture(user);

    const { displayName, username, discriminator } = settings.store;

    user.globalName = displayName?.trim() ? displayName.trim() : original.globalName;
    user.username = username?.trim() ? username.trim() : original.username;
    user.discriminator = discriminator?.trim() ? discriminator.trim() : original.discriminator;
}

function restore() {
    const user: any = UserStore?.getCurrentUser();
    if (!user || !captured) return;

    user.globalName = original.globalName;
    user.username = original.username;
    user.discriminator = original.discriminator;
}

export default definePlugin({
    name: "FakeUsername",
    description: "Show yourself under a different name. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    // Discord rebuilds the user object on reconnect and rewrites it on every user
    // update, so re-stamp our values whenever that happens.
    flux: {
        CONNECTION_OPEN: () => {
            captured = false;
            apply();
        },
        USER_UPDATE: () => apply()
    },

    start() {
        apply();
    },

    stop() {
        restore();
        captured = false;
    }
});
