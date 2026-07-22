/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { PresenceStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. The fake activity is inserted as the presence
// store is read, so only your client sees it. Nothing is broadcast to Discord and
// your friends still see your real status.

const settings = definePluginSettings({
    activityType: {
        type: OptionType.SELECT,
        description: "What the status line says",
        options: [
            { label: "Playing", value: 0, default: true },
            { label: "Listening to", value: 2 },
            { label: "Watching", value: 3 },
            { label: "Competing in", value: 5 }
        ]
    },
    name: {
        type: OptionType.STRING,
        description: "Name shown after the verb, e.g. a game. Empty disables the fake status.",
        default: ""
    },
    details: {
        type: OptionType.STRING,
        description: "First detail line (optional)",
        default: ""
    },
    state: {
        type: OptionType.STRING,
        description: "Second detail line (optional)",
        default: ""
    }
});

/* Rebuilt only when the settings actually change, so the object identity stays
 * stable — components subscribed to the presence store would otherwise re-render
 * on every read. */
let cachedActivity: any = null;
let cachedKey = "";

function fakeActivity(): any | null {
    const { activityType, name, details, state } = settings.store;
    if (!name?.trim()) return null;

    const key = JSON.stringify([activityType, name, details, state]);
    if (key !== cachedKey) {
        cachedKey = key;
        cachedActivity = {
            name: name.trim(),
            type: Number(activityType) || 0,
            id: "cc-fakestatus",
            application_id: "0",
            created_at: Date.now(),
            ...(details?.trim() ? { details: details.trim() } : {}),
            ...(state?.trim() ? { state: state.trim() } : {})
        };
    }
    return cachedActivity;
}

/* Same idea for the array we hand back: reuse it while the real one is unchanged. */
let lastReal: any = null;
let lastResult: any = null;

let originalGetActivities: ((userId: string, guildId?: string) => any[]) | null = null;

function hookPresenceStore() {
    if (originalGetActivities || !PresenceStore?.getActivities) return;

    originalGetActivities = PresenceStore.getActivities.bind(PresenceStore);
    (PresenceStore as any).getActivities = (userId: string, guildId?: string) => {
        const real = originalGetActivities!(userId, guildId);
        const me = UserStore?.getCurrentUser();
        const fake = fakeActivity();

        if (!fake || !me || userId !== me.id) return real;

        if (real === lastReal && lastResult) return lastResult;
        lastReal = real;
        lastResult = [fake, ...(real ?? [])];
        return lastResult;
    };
}

function unhookPresenceStore() {
    if (!originalGetActivities) return;
    (PresenceStore as any).getActivities = originalGetActivities;
    originalGetActivities = null;
    lastReal = lastResult = null;
}

export default definePlugin({
    name: "FakeStatus",
    description: "Show yourself playing, listening to or watching anything you like. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        hookPresenceStore();
    },

    stop() {
        unhookPresenceStore();
    }
});
