/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. This only makes *your* client draw the Nitro
// badge on your own profile. Discord's servers still know you're not subscribed,
// no premium feature actually unlocks, and nobody else sees any difference.

const settings = definePluginSettings({
    tier: {
        type: OptionType.SELECT,
        description: "Which subscription to show off",
        options: [
            { label: "Nitro", value: 2, default: true },
            { label: "Nitro Basic", value: 3 },
            { label: "Nitro Classic", value: 1 },
            { label: "None (off)", value: 0 }
        ]
    },
    since: {
        type: OptionType.STRING,
        description: "Subscriber since, as YYYY-MM-DD. Empty for one year ago.",
        default: ""
    },
    boosting: {
        type: OptionType.BOOLEAN,
        description: "Also show the server boosting badge",
        default: false
    }
});

function sinceDate(): string {
    const raw = settings.store.since?.trim();
    if (raw && !Number.isNaN(Date.parse(raw))) return new Date(raw).toISOString();

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return oneYearAgo.toISOString();
}

/** The badge is derived from the user object, so stamp it there too. */
function applyToUser() {
    const user: any = UserStore?.getCurrentUser();
    if (!user) return;

    const tier = Number(settings.store.tier);
    user.premiumType = tier || null;
}

let originalGetUserProfile: ((userId: string) => any) | null = null;

function hookProfileStore() {
    if (originalGetUserProfile || !UserProfileStore?.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);
    (UserProfileStore as any).getUserProfile = (userId: string) => {
        // Mutated in place to keep the object identity stable.
        const profile: any = originalGetUserProfile!(userId);
        const me = UserStore?.getCurrentUser();
        if (!profile || !me || userId !== me.id) return profile;

        const tier = Number(settings.store.tier);
        if (!tier) return profile;

        profile.premiumType = tier;
        profile.premiumSince = sinceDate();
        if (settings.store.boosting) profile.premiumGuildSince = sinceDate();

        return profile;
    };
}

function unhookProfileStore() {
    if (!originalGetUserProfile) return;
    (UserProfileStore as any).getUserProfile = originalGetUserProfile;
    originalGetUserProfile = null;
}

export default definePlugin({
    name: "FakePremium",
    description: "Show the Nitro badge on your own profile. Cosmetic and local only — no premium feature actually unlocks and nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    flux: {
        CONNECTION_OPEN: () => applyToUser(),
        USER_UPDATE: () => applyToUser()
    },

    start() {
        applyToUser();
        hookProfileStore();
    },

    stop() {
        unhookProfileStore();
        const user: any = UserStore?.getCurrentUser();
        if (user) user.premiumType = null;
    }
});
