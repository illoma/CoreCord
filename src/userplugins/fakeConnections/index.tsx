/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Select, TextInput, useState, UserProfileStore, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Connections are read off the profile object, so
// we stamp ours on as it's read. Nothing is linked for real, Discord's servers know
// nothing about it, and other people still see your genuine connections.

interface FakeConnection {
    type: string;
    name: string;
}

const PLATFORMS = [
    ["tiktok", "TikTok"], ["twitch", "Twitch"], ["instagram", "Instagram"],
    ["twitter", "X (Twitter)"], ["youtube", "YouTube"], ["github", "GitHub"],
    ["spotify", "Spotify"], ["steam", "Steam"], ["xbox", "Xbox"],
    ["playstation", "PlayStation"], ["reddit", "Reddit"], ["roblox", "Roblox"],
    ["epicgames", "Epic Games"], ["battlenet", "Battle.net"], ["riotgames", "Riot Games"],
    ["leagueoflegends", "League of Legends"], ["bungie", "Bungie.net"],
    ["crunchyroll", "Crunchyroll"], ["soundcloud", "SoundCloud"], ["facebook", "Facebook"],
    ["paypal", "PayPal"], ["ebay", "eBay"], ["bluesky", "Bluesky"],
    ["mastodon", "Mastodon"], ["domain", "Domain"], ["skype", "Skype"]
] as const;

const labelFor = (type: string) =>
    PLATFORMS.find(([value]) => value === type)?.[1] ?? type;

function getList(): FakeConnection[] {
    const list = settings.store.list;
    return Array.isArray(list) ? list : [];
}

function ConnectionsEditor() {
    const { list } = settings.use(["list"]);
    const items: FakeConnection[] = Array.isArray(list) ? list : [];

    const [type, setType] = useState<string>("tiktok");
    const [name, setName] = useState("");

    function add() {
        const trimmed = name.trim();
        if (!trimmed) return;
        settings.store.list = [...items, { type, name: trimmed }];
        setName("");
    }

    function remove(index: number) {
        settings.store.list = items.filter((_, i) => i !== index);
    }

    return (
        <div className="cc-fc">
            <div className="cc-fc-row">
                <div className="cc-fc-select">
                    <Select
                        options={PLATFORMS.map(([value, label]) => ({ label, value }))}
                        placeholder="Platform"
                        maxVisibleItems={8}
                        closeOnSelect={true}
                        select={(v: string) => setType(v)}
                        isSelected={(v: string) => v === type}
                        serialize={(v: string) => v}
                    />
                </div>
                <TextInput
                    value={name}
                    onChange={(v: string) => setName(v)}
                    placeholder="Username"
                    className="cc-fc-input"
                />
                <Button onClick={add} disabled={!name.trim()}>Add</Button>
            </div>

            {items.length === 0
                ? <div className="cc-fc-empty">No fake connections yet.</div>
                : (
                    <div className="cc-fc-list">
                        {items.map((item, index) => (
                            <div className="cc-fc-item" key={`${item.type}-${item.name}-${index}`}>
                                <span className="cc-fc-platform">{labelFor(item.type)}</span>
                                <span className="cc-fc-name">{item.name}</span>
                                <Button
                                    size={Button.Sizes.MIN}
                                    color={Button.Colors.RED}
                                    look={Button.Looks.LINK}
                                    onClick={() => remove(index)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}

const settings = definePluginSettings({
    list: {
        type: OptionType.COMPONENT,
        description: "Fake connections shown on your profile",
        default: [] as FakeConnection[],
        component: ConnectionsEditor
    },
    replaceReal: {
        type: OptionType.BOOLEAN,
        description: "Hide your real connections and show only these",
        default: false
    },
    verified: {
        type: OptionType.BOOLEAN,
        description: "Show them as verified",
        default: true
    }
});

/* Cached so a given setting always yields the very same array instance: rebuilding it
 * on every profile read would re-render subscribed components forever. */
let cacheKey = "";
let cacheFakes: any[] = [];

function fakeConnections() {
    const items = getList();
    const key = JSON.stringify([items, settings.store.verified]);
    if (key === cacheKey) return cacheFakes;

    cacheKey = key;
    cacheFakes = items
        .filter(item => item?.type && item?.name)
        .map(item => ({
            type: item.type,
            id: `cc-${item.type}-${item.name}`,
            name: item.name,
            verified: !!settings.store.verified,
            visibility: 1,
            metadata: undefined,
            revoked: false
        }));

    return cacheFakes;
}

/** Ours are tagged so they can be stripped back out — otherwise merging with an
 *  already-modified profile would stack the same entries again and again. */
function isOurs(connection: any) {
    return typeof connection?.id === "string" && connection.id.startsWith("cc-");
}

/* Reuse the merged array while neither side has changed. Comparing by identity is no
 * good here (filtering makes a new array every call), so compare a signature instead. */
let lastRealKey: string | null = null;
let lastFakes: any = null;
let lastMerged: any = null;

let originalGetUserProfile: ((userId: string) => any) | null = null;

function hookProfileStore() {
    if (originalGetUserProfile || !UserProfileStore?.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);
    (UserProfileStore as any).getUserProfile = (userId: string) => {
        // Mutated in place so the profile keeps its identity.
        const profile: any = originalGetUserProfile!(userId);
        const me = UserStore?.getCurrentUser();
        if (!profile || !me || userId !== me.id) return profile;

        const fakes = fakeConnections();
        if (!fakes.length && !settings.store.replaceReal) return profile;

        // Always rebuild from the genuine connections, never from a list we already
        // stamped, or the fakes would pile up on every read.
        const existing: any[] = profile.connectedAccounts ?? [];
        const real = settings.store.replaceReal ? [] : existing.filter(c => !isOurs(c));

        const realKey = real.map(c => `${c?.type}:${c?.id ?? c?.name}`).join("|");
        if (realKey !== lastRealKey || fakes !== lastFakes || !lastMerged) {
            lastRealKey = realKey;
            lastFakes = fakes;
            lastMerged = [...real, ...fakes];
        }

        profile.connectedAccounts = lastMerged;
        return profile;
    };
}

function unhookProfileStore() {
    if (!originalGetUserProfile) return;
    (UserProfileStore as any).getUserProfile = originalGetUserProfile;
    originalGetUserProfile = null;
    lastRealKey = null;
    lastFakes = lastMerged = null;
}

export default definePlugin({
    name: "FakeConnections",
    description: "Show any connected accounts you like on your own profile. Cosmetic and local only — nothing is linked and nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    start() {
        hookProfileStore();
    },

    stop() {
        unhookProfileStore();
    }
});
