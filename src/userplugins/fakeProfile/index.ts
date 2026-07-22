/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Your profile is rebuilt from the profile store
// every time Discord refetches it, so rather than writing into the store we
// intercept the read and stamp our values on the way out — the object is mutated
// in place so its identity stays stable and React doesn't re-render forever.
// Nothing is sent to Discord, and nobody else sees any of this.

const BANNER_SENTINEL = "ccbanner0000c0r3c0rd0000fakeprofile";
const STYLE_ID = "cc-fakeprofile-banner";

const settings = definePluginSettings({
    bannerUrl: {
        type: OptionType.STRING,
        description: "Image URL (or data: URI) to use as your profile banner. Empty to keep the real one.",
        default: "",
        onChange: () => {
            applyBannerStyle();
            swapBannerImages();
        }
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
    }
});

function hexToInt(hex: string): number | null {
    const cleaned = (hex ?? "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(cleaned)) return null;
    return parseInt(cleaned, 16);
}

/* The banner is a CDN hash rather than a URL, so we hand Discord a sentinel hash
 * and swap the resulting image ourselves — the same trick that makes the fake tag
 * icon work. Banners show up both as <img> and as background images, so cover both. */
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
    description: "Set your own banner from any image URL, plus a custom About Me, pronouns and profile colours. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        hookProfileStore();
        applyBannerStyle();
        swapBannerImages();
        startObserver();
    },

    stop() {
        unhookProfileStore();
        observer?.disconnect();
        observer = null;
        document.getElementById(STYLE_ID)?.remove();
    }
});
