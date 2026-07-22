/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, RestAPI, UserStore } from "@webpack/common";

// NOTE: Purely cosmetic and LOCAL. Equipping a decoration here only changes what *you*
// see on your own client. Nothing is purchased or unlocked on Discord's side, and other
// users still see your real avatar.

const STORE_KEY = "CoreCord_Decorations";
const CDN = "https://cdn.discordapp.com/avatar-decoration-presets";

/** Endpoints to try, in order — Discord has moved this around before. */
const CATALOG_ENDPOINTS = [
    "/collectibles-categories",
    "/collectibles-categories?locale=en-US"
];

interface Deco {
    asset: string;
    name: string;
    skuId: string;
}

let catalog: Deco[] = [];

export function decoUrl(asset: string, size = 96) {
    return `${CDN}/${asset}.png?size=${size}&passthrough=false`;
}

/** Walks the API response and picks up anything that looks like a decoration asset.
 *  Written defensively so a shape change upstream doesn't break the whole picker. */
function collect(node: any, out: Map<string, Deco>, inheritedName?: string) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
        for (const child of node) collect(child, out, inheritedName);
        return;
    }

    const name = typeof node.name === "string" ? node.name : inheritedName;
    const asset =
        typeof node.asset === "string" ? node.asset :
            typeof node?.avatar_decoration?.asset === "string" ? node.avatar_decoration.asset :
                null;

    if (asset && /^[a-z0-9_]+$/i.test(asset) && asset.length >= 8) {
        out.set(asset, {
            asset,
            name: String(name ?? "Decoration"),
            skuId: String(node.sku_id ?? node.skuId ?? "0")
        });
    }

    for (const value of Object.values(node)) collect(value, out, name);
}

async function fetchCatalog(): Promise<Deco[]> {
    let lastError: unknown = null;

    for (const url of CATALOG_ENDPOINTS) {
        try {
            const res: any = await RestAPI.get({ url });
            const found = new Map<string, Deco>();
            collect(res?.body, found);
            if (found.size) {
                const list = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
                await DataStore.set(STORE_KEY, list);
                return list;
            }
        } catch (err) {
            lastError = err;
        }
    }

    console.warn("[CoreCord FakeDecoration] Could not load the decoration catalog.", lastError);
    return [];
}

/** Remembers the skuId of a decoration picked straight from Discord's own modal. */
let lastSkuId: string | null = null;

function applyDecoration() {
    const user = UserStore?.getCurrentUser();
    if (!user) return;

    const asset = (settings.store.asset ?? "").trim();
    if (!asset) {
        (user as any).avatarDecorationData = null;
        return;
    }

    const known = catalog.find(d => d.asset === asset);
    (user as any).avatarDecorationData = {
        asset,
        skuId: known?.skuId ?? lastSkuId ?? "0",
        expires_at: null
    };
}

function DecorationPicker() {
    const { asset } = settings.use(["asset"]);
    const [list, setList] = React.useState<Deco[]>(catalog);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (catalog.length) return;
        DataStore.get<Deco[]>(STORE_KEY).then(cached => {
            if (cached?.length) {
                catalog = cached;
                setList(cached);
            }
        });
    }, []);

    async function load() {
        setLoading(true);
        const fetched = await fetchCatalog();
        catalog = fetched;
        setList(fetched);
        setLoading(false);
    }

    function choose(a: string) {
        settings.store.asset = settings.store.asset === a ? "" : a;
        applyDecoration();
    }

    return (
        <>
            <div className="cc-deco-bar">
                <button className="cc-deco-btn" onClick={load} disabled={loading}>
                    {loading ? "Loading…" : list.length ? "Reload from Discord" : "Load decorations from Discord"}
                </button>
                <span className="cc-deco-hint">
                    {list.length ? `${list.length} decorations — click one to equip, click again to remove.` : "No decorations loaded yet."}
                </span>
            </div>

            <div className="cc-deco-picker">
                {list.map(d => (
                    <div
                        key={d.asset}
                        className={"cc-deco-item" + (asset === d.asset ? " selected" : "")}
                        onClick={() => choose(d.asset)}
                        role="button"
                        title={d.name}
                    >
                        <img src={decoUrl(d.asset)} width={64} height={64} alt={d.name} loading="lazy" />
                        <span className="cc-deco-label">{d.name}</span>
                    </div>
                ))}
            </div>
        </>
    );
}

const settings = definePluginSettings({
    asset: {
        type: OptionType.STRING,
        description: "Decoration asset hash. Usually set by the picker below, but you can paste one manually.",
        default: "",
        onChange: () => applyDecoration()
    },
    picker: {
        type: OptionType.COMPONENT,
        description: "Browse and equip any decoration",
        component: DecorationPicker
    }
});

export default definePlugin({
    name: "FakeDecoration",
    description: "Unlocks every avatar decoration in Discord's own picker and lets you wear any of them. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    patches: [
        {
            // Discord's "Change avatar decoration" modal
            find: "80,onlyAnimateOnHoverOrFocus:!",
            replacement: [
                {
                    // Decorations you don't own are pushed into the "preview" section, which is
                    // what renders the padlock. Send them to the owned section instead.
                    match: /(\i)\.preview\.push\((\i)\)/,
                    replace: "$1.purchase.push($2)"
                },
                {
                    // Equip the decoration locally as soon as it's clicked in the grid.
                    match: /(?<=canUsePremiumCollectibles:\i,isSelected:\i,)onSelect:\(\)=>(\i)\((\i)\)/,
                    replace: "onSelect:()=>{$self.applyLocal($2);$1($2)}"
                },
                {
                    // Footer picks "Apply" only when you own the item, otherwise it offers the
                    // shop. Always take the Apply branch.
                    match: /null!=\i&&\(\i\|\|!\i\)\|\|null===\i(?=\?)/,
                    replace: "true"
                }
            ]
        }
    ],

    /** Called from the patched modal when you click a decoration. */
    applyLocal(decoration: any) {
        const asset = decoration?.asset ?? decoration?.avatarDecoration?.asset;
        if (!asset) return;
        lastSkuId = decoration?.skuId ?? null;
        settings.store.asset = asset;
        applyDecoration();
    },

    flux: {
        CONNECTION_OPEN: () => applyDecoration()
    },

    async start() {
        catalog = (await DataStore.get<Deco[]>(STORE_KEY)) ?? [];
        applyDecoration();
    },

    stop() {
        const user = UserStore?.getCurrentUser();
        if (user) (user as any).avatarDecorationData = null;
    }
});
