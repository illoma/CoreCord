/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Connections are read off the profile object, so
// we stamp ours on as it's read. Nothing is linked for real, Discord's servers know
// nothing about it, and other people still see your genuine connections.

const settings = definePluginSettings({
    connections: {
        type: OptionType.STRING,
        description: "One per line as platform:username — e.g. tiktok:monpseudo, twitch:monpseudo, github:illoma",
        default: ""
    },
    replaceReal: {
        type: OptionType.BOOLEAN,
        description: "Hide your real connections and show only these",
        default: false
    },
    verified: {
        type: OptionType.BOOLEAN,
        description: "Show them as verified",
        default: true
    }
});

/* Cached so a given setting always yields the very same array instance: rebuilding it
 * on every profile read would re-render subscribed components forever. */
let cacheKey = "";
let cacheFakes: any[] = [];

function fakeConnections() {
    const raw = settings.store.connections ?? "";
    const key = `${raw}|${settings.store.verified}`;
    if (key === cacheKey) return cacheFakes;

    cacheKey = key;
    cacheFakes = raw
        .split(/[\n,]/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const separator = line.indexOf(":");
            const type = (separator === -1 ? line : line.slice(0, separator)).trim().toLowerCase();
            const name = (separator === -1 ? line : line.slice(separator + 1)).trim();
            if (!type || !name) return null;
            return {
                type,
                id: `cc-${type}-${name}`,
                name,
                verified: !!settings.store.verified,
                visibility: 1,
                metadata: undefined,
                revoked: false
            };
        })
        .filter(Boolean) as any[];

    return cacheFakes;
}

/** Ours are tagged so they can be stripped back out — otherwise merging with an
 *  already-modified profile would stack the same entries again and again. */
function isOurs(connection: any) {
    return typeof connection?.id === "string" && connection.id.startsWith("cc-");
}

/* Reuse the merged array while neither side has changed. Comparing by identity is no
 * good here (filtering makes a new array every call), so compare a signature instead. */
let lastRealKey: string | null = null;
let lastFakes: any = null;
let lastMerged: any = null;

let originalGetUserProfile: ((userId: string) => any) | null = null;

function hookProfileStore() {
    if (originalGetUserProfile || !UserProfileStore?.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);
    (UserProfileStore as any).getUserProfile = (userId: string) => {
        // Mutated in place so the profile keeps its identity.
        const profile: any = originalGetUserProfile!(userId);
        const me = UserStore?.getCurrentUser();
        if (!profile || !me || userId !== me.id) return profile;

        const fakes = fakeConnections();
        if (!fakes.length && !settings.store.replaceReal) return profile;

        // Always rebuild from the genuine connections, never from a list we already
        // stamped, or the fakes would pile up on every read.
        const existing: any[] = profile.connectedAccounts ?? [];
        const real = settings.store.replaceReal ? [] : existing.filter(c => !isOurs(c));

        const realKey = real.map(c => `${c?.type}:${c?.id ?? c?.name}`).join("|");
        if (realKey !== lastRealKey || fakes !== lastFakes || !lastMerged) {
            lastRealKey = realKey;
            lastFakes = fakes;
            lastMerged = [...real, ...fakes];
        }

        profile.connectedAccounts = lastMerged;
        return profile;
    };
}

function unhookProfileStore() {
    if (!originalGetUserProfile) return;
    (UserProfileStore as any).getUserProfile = originalGetUserProfile;
    originalGetUserProfile = null;
    lastRealKey = null;
    lastFakes = lastMerged = null;
}

export default definePlugin({
    name: "FakeConnections",
    description: "Show any connected accounts you like on your own profile. Cosmetic and local only — nothing is linked and nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        hookProfileStore();
    },

    stop() {
        unhookProfileStore();
    }
});
