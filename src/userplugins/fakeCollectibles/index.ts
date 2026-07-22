/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

// NOTE: Purely cosmetic and LOCAL. Discord sorts collectibles you don't own into a
// "preview" section, which is what draws the padlock. We send them to the owned
// section instead, so the pickers show everything unlocked on *your* client.
// Nothing is purchased, and nobody else sees any difference.
//
// Each patch below repeats its replacement on purpose: Vencord mutates replacement
// objects while registering them, so sharing one object across patches is unsafe.

export default definePlugin({
    name: "FakeCollectibles",
    description: "Unlocks profile frames, nameplates and profile effects in Discord's own pickers. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: true,

    patches: [
        {
            // Profile frames picker
            find: "useProfileFrameSections",
            replacement: [
                {
                    match: /(\i)\.preview\.push\((\i)\)/,
                    replace: "$1.purchase.push($2)"
                },
                {
                    // Footer offers "Apply" only for owned frames, otherwise the shop.
                    // Always take the Apply branch.
                    match: /null!=\i&&\(\i\|\|!\i\)\|\|null===\i(?=\?)/,
                    replace: "true"
                }
            ]
        },
        {
            // Nameplates picker
            find: "selectedNameplate",
            replacement: {
                match: /(\i)\.preview\.push\((\i)\)/,
                replace: "$1.purchase.push($2)"
            }
        },
        {
            // Profile effects picker
            find: "selectedProfileEffectRef",
            replacement: {
                match: /(\i)\.preview\.push\((\i)\)/,
                replace: "$1.purchase.push($2)"
            }
        }
    ]
});
