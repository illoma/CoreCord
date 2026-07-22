/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, UserStore } from "@webpack/common";

// NOTE: This is purely cosmetic and LOCAL. It only changes what *you* see on
// your own client. Other users always see your real profile — a client mod
// cannot push a fake tag to anyone else.

const settings = definePluginSettings({
    tag: {
        type: OptionType.STRING,
        description: "The tag text shown next to your name (Discord tags are 4 chars). Press Ctrl+R after changing.",
        default: "CORE",
        onChange: () => applyTag()
    },
    borrowFrom: {
        type: OptionType.STRING,
        description: "Guild ID to borrow the tag ICON from (a server you're in that has a Server Tag). Empty = auto-detect. Ctrl+R after changing.",
        default: "",
        onChange: () => applyTag()
    }
});

/**
 * Discord serves tag badges from its own CDN (guild-tag-badges/{guildId}/{hash}),
 * so to show a real icon we borrow a real (guildId, badge) pair from a server the
 * user is already in that has a Server Tag. This also makes the hover popout resolve
 * to a real guild instead of "Unknown Server".
 */
function findBadgeSource(): { guildId: string; badge: string; } {
    const override = settings.store.borrowFrom?.trim();
    if (override) {
        const g = GuildStore?.getGuild(override);
        return { guildId: override, badge: g?.profile?.badge ?? "" };
    }

    const guilds = GuildStore?.getGuildsArray?.() ?? [];
    // prefer a guild that actually has a tag badge -> real icon
    const withBadge = guilds.find(g => g?.profile?.badge);
    if (withBadge) return { guildId: withBadge.id, badge: withBadge.profile!.badge! };

    // fallback: any real guild so the popout at least resolves (no icon)
    const any = guilds[0];
    return { guildId: any?.id ?? "0", badge: "" };
}

function buildClan() {
    const { guildId, badge } = findBadgeSource();
    return {
        badge,
        tag: settings.store.tag.slice(0, 4).toUpperCase(),
        identityEnabled: true,
        identityGuildId: guildId
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
