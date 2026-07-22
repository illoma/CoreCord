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

/** Every collectible picker sorts items the same way, so they share one replacement. */
const unlockPreviewSection = {
    match: /(\i)\.preview\.push\((\i)\)/,
    replace: "$1.purchase.push($2)"
} as const;

export default definePlugin({
    name: "FakeCollectibles",
    description: "Unlocks profile frames, nameplates and profile effects in Discord's own pickers. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,

    patches: [
        {
            // Profile frames picker
            find: "useProfileFrameSections",
            replacement: [unlockPreviewSection]
        },
        {
            // Nameplates picker
            find: "isCategoryReward",
            replacement: [unlockPreviewSection]
        },
        {
            // Profile effects picker
            find: "9x1v/p",
            replacement: [unlockPreviewSection]
        }
    ]
});
