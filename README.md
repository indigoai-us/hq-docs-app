# Indigo Docs

Turn any HQ folder into a polished, browsable documentation site with macOS-native glass UI.

Built with [Tauri 2](https://v2.tauri.app), React 19, and TypeScript.

## Features

- **Glass UI** -- macOS-native vibrancy with frosted-glass panels, transparent titlebar, and Indigo accent colors
- **Markdown rendering** -- Full GFM support with syntax highlighting (shiki), tables, task lists, and a floating table of contents
- **Mermaid diagrams** -- Inline SVG rendering of flowcharts, sequence diagrams, ER diagrams, and more with click-to-zoom
- **Charts** -- Interactive Recharts visualizations from `chart` code blocks (bar, line, area, pie, radar)
- **Cmd+K search** -- Command palette with qmd integration for keyword, semantic, and hybrid search
- **File watching** -- Live reload when docs change on disk
- **Folder picker** -- Native folder picker on first launch with recent folders and reconnect prompts
- **Keyboard shortcuts** -- Cmd+B sidebar toggle, Cmd+K search, Cmd+, settings, arrow key navigation
- **Company isolation** -- Color-coded sidebar sections for multi-company HQ setups
- **INDEX.md landing pages** -- Directories render as card-based landing pages with status badges

## Install

Download the latest release for your platform from [GitHub Releases](../../releases).

| Platform | File | Notes |
|----------|------|-------|
| **macOS (Apple Silicon)** | `Indigo Docs_x.x.x_aarch64.dmg` | M1, M2, M3, M4 |
| **macOS (Intel)** | `Indigo Docs_x.x.x_x64.dmg` | Pre-2020 Macs |
| **Windows** | `Indigo Docs_x.x.x_x64-setup.msi` | Windows 10+ |
| **Linux** | `Indigo Docs_x.x.x_amd64.AppImage` | Most distros |
| **Linux (Debian)** | `Indigo Docs_x.x.x_amd64.deb` | Ubuntu, Debian |

### macOS

1. Download the `.dmg` for your architecture
2. Open the `.dmg` and drag **Indigo Docs** to your Applications folder
3. Launch from Applications (you may need to right-click and select "Open" on first launch)

### Windows

1. Download the `.msi` installer
2. Run the installer and follow the prompts
3. Launch from the Start Menu

### Linux

**AppImage:**
```bash
chmod +x Indigo\ Docs_*.AppImage
./Indigo\ Docs_*.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i indigo-docs_*_amd64.deb
```

## Connect Your HQ

1. Launch Indigo Docs
2. On the welcome screen, click **Connect your HQ**
3. Select your HQ folder in the native file picker
4. Your docs appear instantly in the sidebar -- browse, search, and read

You can change your HQ folder at any time from Settings (Cmd+,).

## Optional: qmd Search

For full-text and semantic search, install [qmd](https://github.com/tobi/qmd):

```bash
brew install tobi/tap/qmd
```

If qmd is not installed, the app works fine -- you just won't have Cmd+K search.

## Development

### Prerequisites

- [Node.js](https://nodejs.org) (LTS)
- [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs)
- Tauri CLI: `cargo install tauri-cli --version "^2"`

### Setup

```bash
pnpm install
pnpm tauri dev
```

### Quality checks

```bash
pnpm typecheck   # TypeScript type checking
pnpm lint        # ESLint
pnpm tauri build # Full production build
```

### Release

Releases are built automatically by GitHub Actions. To create a release:

1. Push to the `release` branch
2. The workflow builds for macOS (universal), Windows (x64), and Linux (x64)
3. A draft GitHub Release is created with all artifacts
4. Review and publish the draft release

You can also trigger a release manually from the Actions tab using `workflow_dispatch`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2 + Vite |
| Frontend | React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| Markdown | react-markdown + rehype/remark + shiki |
| Diagrams | mermaid.js (lazy-loaded) |
| Charts | Recharts |
| Search | qmd CLI (optional) |
| File watching | Rust notify crate |

## License

MIT

---

Built by [Indigo](https://getindigo.ai)
