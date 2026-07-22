/*
 * CoreCord, a Discord client mod (fork of Vencord)
 * Copyright (c) 2025 illoma and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

import { TAG_ICON_NUMBERS, TAG_ICONS } from "./icons";

// NOTE: Purely cosmetic and LOCAL. This renders a tag next to *your own* name on
// *your* client only, using Vencord's stable decoration APIs (no fragile Discord
// patches). Nobody else ever sees it — a client mod cannot push a tag to others.

const DECORATION_KEY = "cc-faketag";

function IconPicker() {
    const { icon } = settings.use(["icon"]);
    return (
        <div className="cc-faketag-picker">
            {TAG_ICON_NUMBERS.map(n => (
                <div
                    key={n}
                    className={"cc-faketag-picker-item" + (icon === n ? " selected" : "")}
                    onClick={() => { settings.store.icon = n; }}
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
        default: "CORE"
    },
    color: {
        type: OptionType.STRING,
        description: "Pill background color (hex, e.g. #7b2fbe). Leave the icon's own colors intact.",
        default: "#7b2fbe"
    },
    coloredIcon: {
        type: OptionType.BOOLEAN,
        description: "Show the icon in its original colors. Turn off for a flat white (monochrome) icon that matches the text.",
        default: true
    },
    icon: {
        type: OptionType.COMPONENT,
        description: "Pick a tag icon",
        default: 21,
        component: IconPicker
    }
});

function FakeTagPill() {
    const { tag, icon, color, coloredIcon } = settings.use(["tag", "icon", "color", "coloredIcon"]);
    const src = TAG_ICONS[icon as number] ?? TAG_ICONS[TAG_ICON_NUMBERS[0]];
    const text = (tag ?? "").slice(0, 4).toUpperCase();

    return (
        <span className="cc-faketag" style={{ background: color || "#7b2fbe" }} aria-label={`Tag: ${text}`}>
            <img
                className={"cc-faketag-icon" + (coloredIcon ? "" : " cc-faketag-icon-mono")}
                src={src}
                width={12}
                height={12}
                alt=""
            />
            {text && <span className="cc-faketag-text">{text}</span>}
        </span>
    );
}

function renderIfSelf(userId?: string) {
    const me = UserStore.getCurrentUser();
    return me && userId && userId === me.id ? <FakeTagPill /> : null;
}

export default definePlugin({
    name: "FakeTag",
    description: "Show a custom server tag (icon + text) next to your OWN name. Cosmetic and local only — nobody else sees it.",
    authors: [{ name: "illoma", id: 0n }],
    tags: ["Fun", "Fake", "CoreCord"],
    enabledByDefault: false,
    dependencies: ["MessageDecorationsAPI", "MemberListDecoratorsAPI"],
    settings,

    start() {
        addMessageDecoration(DECORATION_KEY, props => renderIfSelf(props?.message?.author?.id));
        addMemberListDecorator(DECORATION_KEY, props => renderIfSelf(props?.user?.id));
    },

    stop() {
        removeMessageDecoration(DECORATION_KEY);
        removeMemberListDecorator(DECORATION_KEY);
    }
});
