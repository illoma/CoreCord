/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Adding a feature flag to the guild object in your
// own client only changes what *you* see. The server is not actually verified or
// partnered, and nobody else sees any difference.

type FakeFeature = "VERIFIED" | "PARTNERED";

/** guildId -> feature we added, so stop() can revert exactly what we changed. */
const applied = new Map<string, FakeFeature>();

function getSelected(): string[] {
    const sel = settings.store.guilds;
    return Array.isArray(sel) ? sel : [];
}

function guildIconUrl(guild: any): string | null {
    return guild?.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=32`
        : null;
}

function GuildPicker() {
    const { guilds } = settings.use(["guilds"]);
    const list: string[] = Array.isArray(guilds) ? guilds : [];
    const all = (GuildStore?.getGuildsArray?.() ?? [])
        .slice()
        .sort((a: any, b: any) => (a?.name ?? "").localeCompare(b?.name ?? ""));

    function toggle(id: string) {
        settings.store.guilds = list.includes(id)
            ? list.filter(x => x !== id)
            : [...list, id];
        applyAll();
    }

    if (!all.length) {
        return <div className="cc-fsb-hint">No servers found.</div>;
    }

    return (
        <>
            <div className="cc-fsb-hint">
                {list.length} server{list.length === 1 ? "" : "s"} selected — click to toggle, then press Ctrl+R.
            </div>
            <div className="cc-fsb-picker">
                {all.map((g: any) => {
                    const icon = guildIconUrl(g);
                    return (
                        <div
                            key={g.id}
                            className={"cc-fsb-item" + (list.includes(g.id) ? " selected" : "")}
                            onClick={() => toggle(g.id)}
                            role="button"
                            title={g.name}
                        >
                            {icon
                                ? <img src={icon} width={24} height={24} alt="" />
                                : <span className="cc-fsb-noicon">{(g.name ?? "?").slice(0, 2).toUpperCase()}</span>}
                            <span className="cc-fsb-label">{g.name}</span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

const settings = definePluginSettings({
    badge: {
        type: OptionType.SELECT,
        description: "Which badge the selected servers should appear to have",
        options: [
            { label: "Verified (checkmark)", value: "VERIFIED", default: true },
            { label: "Partnered", value: "PARTNERED" }
        ],
        onChange: () => applyAll()
    },
    guilds: {
        type: OptionType.COMPONENT,
        description: "Pick the servers",
        default: [] as string[],
        component: GuildPicker
    }
});

function revert() {
    for (const [id, feature] of applied) {
        GuildStore?.getGuild(id)?.features?.delete(feature as any);
    }
    applied.clear();
}

function applyAll() {
    revert();

    const feature = (settings.store.badge ?? "VERIFIED") as FakeFeature;
    for (const id of getSelected()) {
        const guild: any = GuildStore?.getGuild(id);
        if (!guild?.features || guild.features.has(feature)) continue;
        guild.features.add(feature);
        applied.set(id, feature);
    }
}

export default definePlugin({
    name: "FakeServerBadges",
    description: "Make any server look Verified or Partnered. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    // Guild objects are rebuilt on a fresh session, so re-apply then.
    flux: {
        CONNECTION_OPEN: () => applyAll()
    },

    start() {
        applyAll();
    },

    stop() {
        revert();
    }
});
