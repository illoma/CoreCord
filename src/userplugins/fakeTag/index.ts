/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

// NOTE: This is purely cosmetic and LOCAL. It only changes what *you* see on
// your own client. Other users always see your real profile — a client mod
// cannot push a fake tag to anyone else.

const settings = definePluginSettings({
    tag: {
        type: OptionType.STRING,
        description: "The tag text shown next to your name (Discord tags are 4 chars). Press Ctrl+R after changing.",
        default: "CORE",
        onChange: () => applyTag()
    }
});

function buildClan() {
    return {
        // no badge asset -> Discord renders just the tag text, no (broken) icon
        badge: "",
        tag: settings.store.tag.slice(0, 4).toUpperCase(),
        identityEnabled: true,
        identityGuildId: "0"
    };
}

function applyTag() {
    const user = UserStore?.getCurrentUser();
    if (!user) return;
    (user as any).primaryGuild = buildClan();
}

function clearTag() {
    const user = UserStore?.getCurrentUser();
    if (user) (user as any).primaryGuild = null;
}

export default definePlugin({
    name: "FakeTag",
    description: "Show a custom server tag next to your OWN name. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    // Re-apply whenever a fresh session loads (the user object is rebuilt then).
    flux: {
        CONNECTION_OPEN: () => applyTag()
    },

    start() {
        applyTag();
    },

    stop() {
        clearTag();
    }
});
