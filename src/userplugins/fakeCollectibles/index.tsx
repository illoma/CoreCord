/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL.
//
// Unlocking: every collectible picker sorts items you don't own into a "preview"
// section, which is what draws the padlock. We push them into the owned section
// instead. The footer likewise only offers "Apply" for owned items, so we force
// that branch too.
//
// Keeping a choice: Discord's own Apply sends the change to the server, which
// rejects it because you don't own the item. So we also capture the click and
// write the value straight onto the local user object — the same trick that makes
// fake avatar decorations stick. Nothing is sent anywhere.

/** Matches both `(d||!h)` and `(!T||H)` shapes of the "is it owned" footer check. */
const alwaysOfferApply = {
    match: /null!=\i&&\(!?\i\|\|!?\i\)\|\|null===\i(?=\?)/,
    replace: "true"
};

const settings = definePluginSettings({
    nameplate: {
        type: OptionType.COMPONENT,
        description: "Nameplate currently forced on your own profile",
        default: null as any,
        component: () => {
            const { nameplate } = settings.use(["nameplate"]);
            return (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {nameplate
                        ? `Nameplate: ${(nameplate as any).label ?? (nameplate as any).skuId} — pick "None" in Discord's picker to clear it.`
                        : "No nameplate forced. Pick one in Settings → Profile → Nameplate."}
                </div>
            );
        }
    },
    effect: {
        type: OptionType.COMPONENT,
        description: "Profile effect currently forced on your own profile",
        default: null as any,
        component: () => {
            const { effect } = settings.use(["effect"]);
            return (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {effect
                        ? `Profile effect: ${(effect as any).title ?? (effect as any).skuId} — pick "None" in Discord's picker to clear it.`
                        : "No profile effect forced. Pick one in Settings → Profile → Profile effect."}
                </div>
            );
        }
    }
});

/* --- Profile effects -----------------------------------------------------
 * Effects don't live on the user object, they come from the profile store and
 * get overwritten whenever Discord refetches your profile. So instead of writing
 * into the store, we intercept the read and stamp our choice onto the profile on
 * the way out. The profile object is mutated in place to keep its identity stable,
 * otherwise components subscribed to the store would re-render forever.
 */
let originalGetUserProfile: ((userId: string) => any) | null = null;

function hookProfileStore() {
    if (originalGetUserProfile || !UserProfileStore?.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);
    (UserProfileStore as any).getUserProfile = (userId: string) => {
        const profile: any = originalGetUserProfile!(userId);
        const effect = settings.store.effect as any;
        const me = UserStore?.getCurrentUser();

        if (profile && effect && me && userId === me.id) {
            profile.profileEffectId = effect.skuId;
            profile.profileEffect = effect;
        }
        return profile;
    };
}

function unhookProfileStore() {
    if (!originalGetUserProfile) return;
    (UserProfileStore as any).getUserProfile = originalGetUserProfile;
    originalGetUserProfile = null;
}

function applyStored() {
    const user: any = UserStore?.getCurrentUser();
    if (!user) return;

    const nameplate = settings.store.nameplate;
    if (nameplate) {
        user.collectibles = { ...(user.collectibles ?? {}), nameplate };
    } else if (user.collectibles?.nameplate) {
        const { nameplate: _drop, ...rest } = user.collectibles;
        user.collectibles = rest;
    }
}

export default definePlugin({
    name: "FakeCollectibles",
    description: "Unlocks profile frames, nameplates and profile effects in Discord's own pickers, and keeps your chosen nameplate. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            // Profile frames picker
            find: "useProfileFrameSections",
            replacement: [
                {
                    match: /(\i)\.preview\.push\((\i)\)/,
                    replace: "$1.purchase.push($2)"
                },
                { ...alwaysOfferApply }
            ]
        },
        {
            // Nameplates picker
            find: "selectedNameplate",
            replacement: [
                {
                    match: /(\i)\.preview\.push\((\i)\)/,
                    replace: "$1.purchase.push($2)"
                },
                {
                    // Remember the clicked nameplate and write it onto the local user
                    match: /nameplate:(\i),section:(\i)\.section,canUsePremiumCollectibles:(\i),isSelected:(\i)\?\.skuId===\1\.skuId,onClick:\(\)=>(\i)\(\1\)/,
                    replace: "nameplate:$1,section:$2.section,canUsePremiumCollectibles:$3,isSelected:$4?.skuId===$1.skuId,onClick:()=>{$self.applyNameplate($1);$5($1)}"
                },
                { ...alwaysOfferApply }
            ]
        },
        {
            // Profile effects picker
            find: "selectedProfileEffectRef",
            replacement: [
                {
                    match: /(\i)\.preview\.push\((\i)\)/,
                    replace: "$1.purchase.push($2)"
                },
                {
                    // Remember the clicked effect. Only the effect item is followed by
                    // canUsePremiumCollectibles, so this can't hit "None" or "Shop".
                    match: /onSelect:\(\)=>(\i)\((\i)\)(?=,canUsePremiumCollectibles)/,
                    replace: "onSelect:()=>{$self.applyEffect($2);$1($2)}"
                },
                { ...alwaysOfferApply }
            ]
        }
    ],

    /** Called from the patched nameplate picker when you click one. */
    applyNameplate(item: any) {
        settings.store.nameplate = item ?? null;
        applyStored();
    },

    /** Called from the patched profile effect picker when you click one. */
    applyEffect(item: any) {
        settings.store.effect = item ?? null;
    },

    flux: {
        CONNECTION_OPEN: () => applyStored()
    },

    start() {
        applyStored();
        hookProfileStore();
    },

    stop() {
        unhookProfileStore();

        const user: any = UserStore?.getCurrentUser();
        if (user?.collectibles?.nameplate) {
            const { nameplate: _drop, ...rest } = user.collectibles;
            user.collectibles = rest;
        }
    }
});
