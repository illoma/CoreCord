/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

import { FAKE_BADGES } from "./badges";

// NOTE: Purely cosmetic and LOCAL. These badges are rendered on *your* client only.
// Other users always see your real profile — a client mod cannot push badges to anyone else.

function getSelected(): string[] {
    const sel = settings.store.selected;
    return Array.isArray(sel) ? sel : [];
}

function BadgePicker() {
    const { selected } = settings.use(["selected"]);
    const list: string[] = Array.isArray(selected) ? selected : [];

    function toggle(id: string) {
        settings.store.selected = list.includes(id)
            ? list.filter(x => x !== id)
            : [...list, id];
    }

    return (
        <>
            <div className="cc-fakebadges-hint">
                {list.length} badge{list.length === 1 ? "" : "s"} selected — click to toggle.
            </div>
            <div className="cc-fakebadges-picker">
                {FAKE_BADGES.map(b => (
                    <div
                        key={b.id}
                        className={"cc-fakebadges-item" + (list.includes(b.id) ? " selected" : "")}
                        onClick={() => toggle(b.id)}
                        role="button"
                        title={b.name}
                    >
                        <img src={b.src} width={24} height={24} alt={b.name} />
                        <span className="cc-fakebadges-label">{b.name}</span>
                    </div>
                ))}
            </div>
        </>
    );
}

const settings = definePluginSettings({
    selected: {
        type: OptionType.COMPONENT,
        description: "Pick the badges to show on your profile",
        default: [] as string[],
        component: BadgePicker
    }
});

const fakeBadge: ProfileBadge = {
    id: "cc-fakebadges",
    position: BadgePosition.START,
    getBadges({ userId }: BadgeUserArgs): ProfileBadge[] {
        const me = UserStore.getCurrentUser();
        if (!me || userId !== me.id) return [];

        const selected = getSelected();
        return FAKE_BADGES
            .filter(b => selected.includes(b.id))
            .map(b => ({
                id: `cc-fakebadge-${b.id}`,
                key: `cc-fakebadge-${b.id}`,
                description: b.name,
                iconSrc: b.src
            }));
    }
};

export default definePlugin({
    name: "FakeBadges",
    description: "Show any Discord profile badges (Nitro, Staff, HypeSquad, Boosts...) on your OWN profile. Cosmetic and local only — nobody else sees them.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    dependencies: ["BadgeAPI"],
    settings,

    start() {
        addProfileBadge(fakeBadge);
    },

    stop() {
        removeProfileBadge(fakeBadge);
    }
});
