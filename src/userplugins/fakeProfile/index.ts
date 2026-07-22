/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { filters, waitFor } from "@webpack";
import { UserProfileStore, UserStore } from "@webpack/common";

/* Discord's premium checks live as methods on a utils object that only loads once
 * you open the profile UI, so we wait for it rather than grabbing it at startup.
 * Only these client-side UI checks are flipped — nothing here tells Discord's
 * servers you're a subscriber. */
const PREMIUM_GATES = [
    "canUsePremiumProfileCustomization",
    "canUsePremiumGuildMemberProfile",
    "canUseCollectibles",
    "canUseClientThemes",
    "canUseCustomBackgrounds"
] as const;

const originalGates = new Map<string, { target: any; fn: Function; }>();

/** Some of these objects expose methods as non-writable props, so try both routes. */
function forceTrue(target: any, name: string) {
    const original = target?.[name];
    if (typeof original !== "function" || originalGates.has(name)) return;

    const stub = () => true;
    originalGates.set(name, { target, fn: original });

    try {
        Object.defineProperty(target, name, { value: stub, writable: true, configurable: true, enumerable: true });
        return;
    } catch { /* not configurable — fall through */ }

    try {
        target[name] = stub;
    } catch { /* nothing else we can do */ }
}

let gateWaiterStarted = false;

function unlockPremiumGates() {
    if (gateWaiterStarted || !settings.store.unlockNitroCustomization) return;
    gateWaiterStarted = true;

    waitFor(filters.byProps("canUsePremiumProfileCustomization"), (mod: any) => {
        for (const name of PREMIUM_GATES) forceTrue(mod, name);
    });
}

function restorePremiumGates() {
    for (const [name, { target, fn }] of originalGates) {
        try {
            Object.defineProperty(target, name, { value: fn, writable: true, configurable: true, enumerable: true });
        } catch {
            try { target[name] = fn; } catch { /* give up */ }
        }
    }
    originalGates.clear();
}

// NOTE: Purely cosmetic and LOCAL. Your profile is rebuilt from the profile store
// every time Discord refetches it, so rather than writing into the store we
// intercept the read and stamp our values on the way out — the object is mutated
// in place so its identity stays stable and React doesn't re-render forever.
// Nothing is sent to Discord, and nobody else sees any of this.

const BANNER_SENTINEL = "ccbanner0000c0r3c0rd0000fakeprofile";
const STYLE_ID = "cc-fakeprofile-banner";

const settings = definePluginSettings({
    unlockNitroCustomization: {
        type: OptionType.BOOLEAN,
        description: "Unlock the Nitro-only parts of Discord's own profile editor (banner, theme colours). Anything you're normally allowed to change still saves to Discord as usual.",
        default: true,
        restartNeeded: true
    },
    bio: {
        type: OptionType.STRING,
        description: "Replace your About Me. Leave empty to keep the real one.",
        default: ""
    },
    pronouns: {
        type: OptionType.STRING,
        description: "Replace your pronouns. Leave empty to keep the real ones.",
        default: ""
    },
    accentColor: {
        type: OptionType.STRING,
        description: "Profile accent colour as hex, e.g. #7b2fbe. Empty to keep the real one.",
        default: ""
    },
    themePrimary: {
        type: OptionType.STRING,
        description: "Profile theme colour 1 (hex). Needs colour 2 as well.",
        default: ""
    },
    themeSecondary: {
        type: OptionType.STRING,
        description: "Profile theme colour 2 (hex).",
        default: ""
    },
    bannerUrl: {
        type: OptionType.STRING,
        description: "Image URL (or data: URI) to use as your profile banner. Empty to keep the real one.",
        default: ""
    }
});

function hexToInt(hex: string): number | null {
    const cleaned = (hex ?? "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(cleaned)) return null;
    return parseInt(cleaned, 16);
}

/** Swap the sentinel banner URL for the chosen image, wherever Discord renders it. */
function applyBannerStyle() {
    const url = settings.store.bannerUrl?.trim();

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!url) {
        el?.remove();
        return;
    }

    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    // Covers banners drawn as a background image; <img> tags are handled by the observer.
    el.textContent = `[style*="${BANNER_SENTINEL}"]{background-image:url("${url}")!important;}`;
}

function swapBannerImages() {
    const url = settings.store.bannerUrl?.trim();
    if (!url) return;
    document.querySelectorAll<HTMLImageElement>(`img[src*="${BANNER_SENTINEL}"]`)
        .forEach(img => { img.src = url; });
}

let observer: MutationObserver | null = null;
let queued = false;

function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            swapBannerImages();
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

let originalGetUserProfile: ((userId: string) => any) | null = null;

function hookProfileStore() {
    if (originalGetUserProfile || !UserProfileStore?.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);
    (UserProfileStore as any).getUserProfile = (userId: string) => {
        const profile: any = originalGetUserProfile!(userId);
        const me = UserStore?.getCurrentUser();
        if (!profile || !me || userId !== me.id) return profile;

        const { bio, pronouns, accentColor, themePrimary, themeSecondary, bannerUrl } = settings.store;

        if (bio?.trim()) profile.bio = bio;
        if (pronouns?.trim()) profile.pronouns = pronouns;

        const accent = hexToInt(accentColor);
        if (accent != null) profile.accentColor = accent;

        const primary = hexToInt(themePrimary);
        const secondary = hexToInt(themeSecondary);
        if (primary != null && secondary != null) profile.themeColors = [primary, secondary];

        if (bannerUrl?.trim()) profile.banner = BANNER_SENTINEL;

        return profile;
    };
}

function unhookProfileStore() {
    if (!originalGetUserProfile) return;
    (UserProfileStore as any).getUserProfile = originalGetUserProfile;
    originalGetUserProfile = null;
}

export default definePlugin({
    name: "FakeProfile",
    description: "Fake your own banner, About Me, pronouns and profile colours. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        hookProfileStore();
        unlockPremiumGates();
        applyBannerStyle();
        swapBannerImages();
        startObserver();
    },

    stop() {
        unhookProfileStore();
        restorePremiumGates();
        observer?.disconnect();
        observer = null;
        document.getElementById(STYLE_ID)?.remove();
    }
});
