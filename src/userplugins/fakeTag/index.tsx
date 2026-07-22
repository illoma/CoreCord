/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, UserStore } from "@webpack/common";

import { TAG_ICON_NUMBERS, TAG_ICONS } from "./icons";

// NOTE: Purely cosmetic and LOCAL. Only *your* client shows this tag. Other users
// always see your real profile — a client mod cannot push a tag to anyone else.
//
// How this works:
//  1. We inject a fake `primaryGuild` on the current user, so Discord renders its
//     OWN native tag pill (correct styling, and it shows up everywhere).
//  2. The injected badge hash is a unique sentinel, so the native <img> ends up with
//     a src nobody else can have. A CSS `content: url(...)` rule on that exact src
//     swaps in the icon you picked. No Discord code is patched.

const SENTINEL = "cctag0000c0r3c0rd0000faketag0000";
const STYLE_ID = "cc-faketag-icon-style";

function IconPicker() {
    const { icon } = settings.use(["icon"]);
    return (
        <div className="cc-faketag-picker">
            {TAG_ICON_NUMBERS.map(n => (
                <div
                    key={n}
                    className={"cc-faketag-picker-item" + (icon === n ? " selected" : "")}
                    onClick={() => { settings.store.icon = n; applyAll(); }}
                    role="button"
                >
                    <img src={TAG_ICONS[n]} width={22} height={22} alt={`Tag icon ${n}`} />
                </div>
            ))}
        </div>
    );
}

const settings = definePluginSettings({
    tag: {
        type: OptionType.STRING,
        description: "Tag text shown next to your name (Discord tags are up to 4 chars).",
        default: "CORE",
        onChange: () => applyAll()
    },
    coloredIcon: {
        type: OptionType.BOOLEAN,
        description: "Show the icon in its original colors. Turn off for a flat white icon.",
        default: true,
        onChange: () => applyAll()
    },
    icon: {
        type: OptionType.COMPONENT,
        description: "Pick a tag icon",
        default: 21,
        component: IconPicker
    }
});

/** A real guild we're in, so the tag's hover popout resolves instead of "Unknown Server". */
function pickGuildId(): string {
    const guilds = GuildStore?.getGuildsArray?.() ?? [];
    return guilds[0]?.id ?? "1";
}

function applyTagData() {
    const user = UserStore?.getCurrentUser();
    if (!user) return;

    (user as any).primaryGuild = {
        badge: SENTINEL,
        tag: (settings.store.tag ?? "").slice(0, 4).toUpperCase(),
        identityEnabled: true,
        identityGuildId: pickGuildId()
    };
}

function applyIconStyle() {
    const src = TAG_ICONS[settings.store.icon as number] ?? TAG_ICONS[TAG_ICON_NUMBERS[0]];

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }

    const mono = settings.store.coloredIcon ? "" : "filter:brightness(0) invert(1);";
    // Swap the native badge image (which points at our sentinel hash) for the chosen icon.
    el.textContent = `img[src*="${SENTINEL}"]{content:url("${src}");object-fit:contain;${mono}}`;
}

function applyAll() {
    applyTagData();
    applyIconStyle();
}

function clearAll() {
    const user = UserStore?.getCurrentUser();
    if (user) (user as any).primaryGuild = null;
    document.getElementById(STYLE_ID)?.remove();
}

export default definePlugin({
    name: "FakeTag",
    description: "Show a custom server tag (icon + text) next to your OWN name, rendered natively by Discord. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    settings,

    // The user object is rebuilt on a fresh session, so re-apply then.
    flux: {
        CONNECTION_OPEN: () => applyAll()
    },

    start() {
        applyAll();
    },

    stop() {
        clearAll();
    }
});
