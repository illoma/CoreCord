# CoreCord 💜

CoreCord is a Discord client mod — a customized fork of [Vencord](https://github.com/Vendicated/Vencord).

- Rich plugin ecosystem inherited from Vencord
- Custom themes and QuickCSS
- Self-updating from this repository
- Purple, because purple is better

## Installing / Uninstalling

CoreCord is built from source. You need [Node.js](https://nodejs.org) (≥ 22), [pnpm](https://pnpm.io) and [git](https://git-scm.com).

```sh
git clone https://github.com/illoma/CoreCord
cd CoreCord
pnpm install --frozen-lockfile
pnpm build
pnpm inject     # patches your local Discord install
```

To remove it again:

```sh
pnpm uninject
```

Restart Discord afterwards. Settings live under **User Settings → CoreCord**.

## Building from source

```sh
pnpm install --frozen-lockfile
pnpm build            # desktop build into dist/
pnpm buildWeb         # browser-extension build
pnpm watch            # rebuild on change during development
```

## Credits & License

CoreCord is a fork of **[Vencord](https://github.com/Vendicated/Vencord)** by Vendicated
and contributors. All of the underlying framework, plugin API and the vast majority of
the code is their work — CoreCord only rebrands it and adds custom plugins/themes.

Please consider supporting the upstream project:
<https://github.com/Vendicated/Vencord> · <https://github.com/sponsors/Vendicated>

Licensed under **GPL-3.0-or-later**, the same license as Vencord. See [LICENSE](LICENSE).
The copyright notices of the original authors are retained throughout the source, as
required by the license.

## Disclaimer

Client mods are, strictly speaking, against Discord's Terms of Service. Vencord (and
therefore CoreCord) does not make requests or automate actions on your account, and
enforcement against customization mods is effectively nonexistent — but you use it at
your own risk. Don't use it to break Discord's rules.
