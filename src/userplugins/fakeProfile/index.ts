/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Nothing is sent to Discord and nobody else sees
// your fake banner.
//
// Discord stores a banner as a CDN hash, not a URL, so we can't just hand it one.
// Instead the profile read is intercepted to return a sentinel hash, and the image
// that Discord then renders is swapped for the chosen URL — the same trick that
// makes the fake tag icon work. Banners appear both as <img> and as background
// images, so both are covered.

const BANNER_SENTINEL = "ccbanner0000c0r3c0rd0000fakeprofile";
const STYLE_ID = "cc-fakeprofile-banner";

const settings = definePluginSettings({
    bannerUrl: {
        type: OptionType.STRING,
        description: "Image URL (or data: URI) to use as your profile banner. Empty to keep your real one.",
        default: "",
        onChange: () => {
            applyBannerStyle();
            swapBannerImages();
        }
    }
});

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
        // Mutated in place so the object keeps its identity — returning a copy would
        // make subscribed components re-render forever.
        const profile: any = originalGetUserProfile!(userId);
        const me = UserStore?.getCurrentUser();
        if (!profile || !me || userId !== me.id) return profile;

        if (settings.store.bannerUrl?.trim()) profile.banner = BANNER_SENTINEL;

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
    description: "Set your profile banner from any image URL. Cosmetic and local only — nobody else sees it.",
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
