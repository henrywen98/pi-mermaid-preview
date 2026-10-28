# Third-party notices

The extension code is an independent implementation.
The following projects provide runtime code, host APIs, or design references.

## Runtime dependencies

| Project | Role | License |
| --- | --- | --- |
| [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid), 1.1.3 | Mermaid-to-terminal rendering | MIT |
| [elkjs](https://github.com/kieler/elkjs), 0.11.1 | Layout dependency of beautiful-mermaid | EPL-2.0 |
| [entities](https://github.com/fb55/entities), 7.0.1 | Text decoding dependency of beautiful-mermaid | BSD-2-Clause |

The installed package metadata and lockfile record the exact versions.
The matching license texts are retained in [LICENSES](LICENSES/).

ELK source is available from https://github.com/kieler/elkjs.
This project does not modify ELK or relicense it under MIT.

## Host APIs

[Pi](https://github.com/earendil-works/pi) provides the extension and terminal UI APIs.
Pi is MIT-licensed.
It is a peer dependency supplied by the host, not bundled into the extension.

## Design references

[Gurpartap/pi-mermaid](https://github.com/Gurpartap/pi-mermaid) informed the manual command and terminal-preview idea.
That project is MIT-licensed.
No implementation code was copied from it.
Its license is retained in LICENSES/pi-mermaid-MIT.txt as a reference.

[Pi extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
and [terminal UI documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/tui.md)
guided API usage.

[Mermaid](https://github.com/mermaid-js/mermaid) defines the diagram language.
It is MIT-licensed. The official Mermaid npm package is not a dependency.

## Development dependencies

The package uses TypeScript, Node.js type definitions, and Pi packages for checks.
Their original licenses remain in the installed packages.
They are not included in the published extension file set.
