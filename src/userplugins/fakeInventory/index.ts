/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { filters, waitFor } from "@webpack";
import { UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Discord builds "Gifts you've purchased" from
// GiftCodeStore.getForGifterSKUAndPlan, so we append stand-in gift codes to whatever
// it returns for you. Nothing is bought, no code is real, and nobody else sees this
// page — it lives in your own billing settings.

const settings = definePluginSettings({
    count: {
        type: OptionType.SLIDER,
        description: "How many fake gifts to show per product (0 turns it off)",
        markers: [0, 1, 2, 3, 5, 10],
        default: 3,
        stickToMarkers: true
    }
});

/** Stable so repeated reads hand back identical objects — a drifting value would
 *  make subscribed components re-render forever. */
const FAKE_EXPIRY = null;
const cache = new Map<string, any[]>();

function fakeGiftsFor(userId: string, skuId: string, planId: string | null) {
    const count = Number(settings.store.count) || 0;
    const key = `${skuId}|${planId ?? ""}|${count}`;

    const cached = cache.get(key);
    if (cached) return cached;

    const gifts = Array.from({ length: count }, (_, i) => ({
        code: `CORECORD${String(i + 1).padStart(3, "0")}`,
        userId,
        skuId,
        subscriptionPlanId: planId ?? null,
        uses: 0,
        maxUses: 1,
        redeemed: false,
        revoked: false,
        expiresAt: FAKE_EXPIRY,
        storeListing: null,
        // The real model is a class; these keep the UI from blowing up on it.
        isExpired: () => false,
        merge(this: any) { return this; },
        set(this: any) { return this; }
    }));

    cache.set(key, gifts);
    return gifts;
}

let store: any = null;
let originalGetForGifter: ((...args: any[]) => any[]) | null = null;
const resultCache = new Map<string, any[]>();

function hookStore(found: any) {
    if (originalGetForGifter || typeof found?.getForGifterSKUAndPlan !== "function") return;

    store = found;
    originalGetForGifter = found.getForGifterSKUAndPlan.bind(found);

    found.getForGifterSKUAndPlan = (userId: string, skuId: string, planId: string | null) => {
        let real: any[] = [];
        try {
            real = originalGetForGifter!(userId, skuId, planId) ?? [];
        } catch {
            return [];
        }

        try {
            const me = UserStore?.getCurrentUser();
            if (!me || userId !== me.id || !Number(settings.store.count)) return real;

            const key = `${skuId}|${planId ?? ""}|${settings.store.count}|${real.length}`;
            const cached = resultCache.get(key);
            if (cached) return cached;

            const merged = [...real, ...fakeGiftsFor(userId, skuId, planId)];
            resultCache.set(key, merged);
            return merged;
        } catch {
            return real;
        }
    };
}

function unhookStore() {
    if (store && originalGetForGifter) store.getForGifterSKUAndPlan = originalGetForGifter;
    store = null;
    originalGetForGifter = null;
    cache.clear();
    resultCache.clear();
}

export default definePlugin({
    name: "FakeInventory",
    description: "Fills 'Gifts you've purchased' with stand-in gifts. Cosmetic and local only — nothing is bought and only you can see that page.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        waitFor(filters.byProps("getForGifterSKUAndPlan"), (mod: any) => hookStore(mod));
    },

    stop() {
        unhookStore();
    }
});
