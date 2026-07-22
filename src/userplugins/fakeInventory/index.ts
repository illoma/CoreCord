/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { filters, waitFor } from "@webpack";

// NOTE: Purely cosmetic and LOCAL. Discord decides what you own from the collectibles
// purchases store, so we shadow it with a map that also contains every known product.
// Nothing is bought and nobody else sees a difference.
//
// This store also feeds the decoration / nameplate / effect / frame pickers, so the
// implementation is deliberately defensive: real purchases always win over fake ones,
// the map is cached so its identity stays stable, and anything unexpected makes the
// plugin quietly do nothing rather than break the pickers.

/** Fixed on purpose — a drifting value would re-render subscribed components forever. */
const FAKE_PURCHASED_AT = "2024-01-01T00:00:00.000Z";

let purchasesStore: any = null;
let originalPurchasesGetter: (() => any) | null = null;
let productsStore: any = null;

let cachedReal: any = null;
let cachedProducts: any = null;
let cachedResult: any = null;

function entriesOf(collection: any): [string, any][] {
    if (!collection) return [];
    if (typeof collection.entries === "function") return [...collection.entries()];
    if (typeof collection === "object") return Object.entries(collection);
    return [];
}

function buildMap(real: any) {
    const products = productsStore?.products;
    const productEntries = entriesOf(products);
    if (!productEntries.length) return real;

    if (real === cachedReal && products === cachedProducts && cachedResult) return cachedResult;

    const merged = new Map<string, any>();
    for (const [skuId] of productEntries) {
        merged.set(String(skuId), {
            skuId: String(skuId),
            purchasedAt: FAKE_PURCHASED_AT,
            type: 0
        });
    }
    // Anything genuinely owned overwrites the stand-in, so real perks stay intact.
    for (const [skuId, purchase] of entriesOf(real)) merged.set(String(skuId), purchase);

    cachedReal = real;
    cachedProducts = products;
    cachedResult = merged;
    return merged;
}

function hookPurchases(store: any) {
    if (originalPurchasesGetter || !store) return;

    // `purchases` is a getter on the prototype, so an own property shadows it.
    let proto = Object.getPrototypeOf(store);
    let descriptor: PropertyDescriptor | undefined;
    while (proto && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(proto, "purchases");
        proto = Object.getPrototypeOf(proto);
    }

    const getter = descriptor?.get;
    if (typeof getter !== "function") return;

    originalPurchasesGetter = getter.bind(store);
    purchasesStore = store;

    try {
        Object.defineProperty(store, "purchases", {
            configurable: true,
            enumerable: false,
            get: () => {
                try {
                    return buildMap(originalPurchasesGetter!());
                } catch {
                    return originalPurchasesGetter!();
                }
            }
        });
    } catch {
        originalPurchasesGetter = null;
        purchasesStore = null;
    }
}

function unhookPurchases() {
    if (!purchasesStore || !originalPurchasesGetter) return;
    try {
        delete purchasesStore.purchases;
    } catch { /* leave it be */ }
    purchasesStore = null;
    originalPurchasesGetter = null;
    cachedReal = cachedProducts = cachedResult = null;
}

export default definePlugin({
    name: "FakeInventory",
    description: "Makes your inventory look like you own every collectible. Cosmetic and local only — nothing is bought and nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,

    start() {
        waitFor(filters.byProps("products", "categories"), (mod: any) => { productsStore = mod; });
        waitFor(filters.byProps("purchases"), (mod: any) => hookPurchases(mod));
    },

    stop() {
        unhookPurchases();
        productsStore = null;
    }
});
