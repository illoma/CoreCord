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
    icon: {
        type: OptionType.COMPONENT,
        description: "Pick a tag icon",
        default: 21,
        component: IconPicker
    }
});

function FakeTagPill() {
    const { tag, icon } = settings.use(["tag", "icon"]);
    const src = TAG_ICONS[icon as number] ?? TAG_ICONS[TAG_ICON_NUMBERS[0]];
    const text = (tag ?? "").slice(0, 4).toUpperCase();

    return (
        <span className="cc-faketag" aria-label={`Tag: ${text}`}>
            <img className="cc-faketag-icon" src={src} width={12} height={12} alt="" />
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
