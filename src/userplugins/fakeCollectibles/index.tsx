/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

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
    }
});

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
                { ...alwaysOfferApply }
            ]
        }
    ],

    /** Called from the patched nameplate picker when you click one. */
    applyNameplate(item: any) {
        settings.store.nameplate = item ?? null;
        applyStored();
    },

    flux: {
        CONNECTION_OPEN: () => applyStored()
    },

    start() {
        applyStored();
    },

    stop() {
        const user: any = UserStore?.getCurrentUser();
        if (user?.collectibles?.nameplate) {
            const { nameplate: _drop, ...rest } = user.collectibles;
            user.collectibles = rest;
        }
    }
});
