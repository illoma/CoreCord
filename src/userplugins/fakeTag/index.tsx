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

function currentIconSrc() {
    return TAG_ICONS[settings.store.icon as number] ?? TAG_ICONS[TAG_ICON_NUMBERS[0]];
}

function applyIconStyle() {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }

    const mono = settings.store.coloredIcon ? "filter:none;" : "filter:brightness(0) invert(1);";
    // Belt and braces: CSS swap (works in Chromium) alongside the JS swap below.
    el.textContent =
        `img[src*="${SENTINEL}"]{content:url("${currentIconSrc()}");object-fit:contain;}` +
        `img[data-cc-faketag]{${mono}object-fit:contain;}`;
}

/** Replace the native badge <img> src with the chosen icon. Survives React re-renders
 *  because the observer re-runs whenever Discord rebuilds the node. */
function swapIcons(): number {
    const src = currentIconSrc();
    const imgs = document.querySelectorAll<HTMLImageElement>(`img[src*="${SENTINEL}"]`);
    imgs.forEach(img => {
        img.dataset.ccFaketag = "1";
        img.src = src;
    });
    return imgs.length;
}

let observer: MutationObserver | null = null;
let queued = false;

function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            swapIcons();
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
    observer?.disconnect();
    observer = null;
}

/** Prints what we can actually find in the DOM, to diagnose a missing icon. */
function diagnose() {
    const sentinelImgs = document.querySelectorAll(`img[src*="${SENTINEL}"]`).length;
    const swapped = document.querySelectorAll("img[data-cc-faketag]").length;
    const tagText = (settings.store.tag ?? "").slice(0, 4).toUpperCase();
    const textEls = [...document.querySelectorAll<HTMLElement>("*")]
        .filter(e => e.children.length === 0 && e.textContent?.trim() === tagText);

    console.log(
        "%c[CoreCord FakeTag] diagnostic",
        "color:#b98ce0;font-weight:bold",
        {
            sentinelImgsFound: sentinelImgs,
            alreadySwapped: swapped,
            tagTextElementsFound: textEls.length,
            tagPillHTML: textEls.slice(0, 2).map(e => e.parentElement?.outerHTML?.slice(0, 400))
        }
    );
    if (!sentinelImgs && !swapped) {
        console.warn("[CoreCord FakeTag] No badge <img> found. Discord probably doesn't render an image for this badge — paste the tagPillHTML above to illoma.");
    }
}

function applyAll() {
    applyTagData();
    applyIconStyle();
    swapIcons();
}

function clearAll() {
    const user = UserStore?.getCurrentUser();
    if (user) (user as any).primaryGuild = null;
    document.getElementById(STYLE_ID)?.remove();
    stopObserver();
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
        startObserver();
        // Give Discord a moment to render the tag, then report what we found.
        setTimeout(diagnose, 4000);
    },

    stop() {
        clearAll();
    },

    // Exposed so you can re-run it from the console: Vencord.Plugins.plugins.FakeTag.diagnose()
    diagnose
});
