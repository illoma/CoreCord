/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { Menu } from "@webpack/common";

const DISCORD_EPOCH = 1420070400000;

function creationDate(id: string): Date {
    return new Date(Number(BigInt(id) >> 22n) + DISCORD_EPOCH);
}

function relativeAge(date: Date): string {
    const totalDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    const years = Math.floor(totalDays / 365);
    const days = totalDays - years * 365;
    const parts: string[] = [];
    if (years) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts.join(", ") + " ago";
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user) return;

    const created = creationDate(user.id);
    const pretty = created.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const info = `${pretty} (${relativeAge(created)})`;

    children.push(
        <Menu.MenuItem
            id="cc-account-age"
            label="Account Age"
            action={() => {
                copyToClipboard(info);
                showNotification({
                    title: `${user.username}'s account`,
                    body: `Created ${info}\n(copied to clipboard)`
                });
            }}
        />
    );
};

export default definePlugin({
    name: "AccountAge",
    description: "Adds an 'Account Age' entry to the user right-click menu showing when the account was created.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Utility", "CoreCord"],
    enabledByDefault: true,
    contextMenus: {
        "user-context": UserContext
    }
});
