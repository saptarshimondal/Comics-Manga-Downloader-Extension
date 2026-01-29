# Contributing to Comics / Manga Downloader Extension

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Contribute

### Reporting Bugs

- Open an [issue](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues) and use a clear, descriptive title.
- Include steps to reproduce, your browser and OS, and any relevant screenshots or error messages.

### Suggesting Features

- Open an [issue](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues) with the tag **"enhancement"**.
- Describe the feature and why it would be useful for the project.

### Pull Requests

We welcome pull requests! Please follow the process below.

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (LTS recommended)
- npm (included with Node.js)
- Webpack (install globally for convenience):
  ```sh
  npm install -g webpack
  ```

### Getting the Code

1. **Fork** the repository on GitHub.

2. **Clone** your fork:
   ```sh
   git clone https://github.com/YOUR_USERNAME/Comics-Manga-Downloader-Extension.git
   cd Comics-Manga-Downloader-Extension
   ```

3. **Add upstream** (optional, for syncing with the main repo):
   ```sh
   git remote add upstream https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension.git
   ```

4. **Install dependencies**:
   ```sh
   npm install
   ```

### Build Commands

| Task | Firefox | Chrome |
|------|---------|--------|
| One-time build | `npm run start:firefox` | `npm run start:chrome` |
| Watch mode (auto-rebuild) | `npm run dev:firefox` | `npm run dev:chrome` |

Output is written to the **`dist`** directory.

**Pack commands** (create distributable `.zip` files):

| Task | Firefox | Chrome | Both |
|------|---------|--------|------|
| Dev (unminified) | `npm run pack:firefox` | `npm run pack:chrome` | `npm run pack:all` |
| Prod (minified) | `npm run pack:firefox -- --prod` | `npm run pack:chrome -- --prod` | `npm run pack:all -- --prod` |

- Dev output: `web-ext-artifacts/firefox/` and `web-ext-artifacts/chrome/chrome-extension.zip`
- Prod uses the same paths; use prod builds for releases.

### Testing the Extension

**Chrome**

- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked** and select the **`dist`** folder
- Reload the extension after code changes

**Firefox**

- Run:
  ```sh
  npm run ext
  ```
- Firefox opens with the extension loaded; it auto-reloads when you change code.

### Packaging (for distribution)

See **Pack commands** in the [Build Commands](#build-commands) section above.

---

## Project Structure

```
src/
├── background/     # Service worker / background script
├── content/        # Content script (injected into pages)
├── options/        # Options page
├── popup/          # Popup UI (HTML, CSS, JS, views)
├── icon/           # Extension icons
├── manifest.json   # Extension manifest (Manifest v3)
└── global.css      # Shared styles
```

The popup uses a simple MVC-style setup with views under `src/popup/js/views/`.

---

## Pull Request Process

1. **Create a branch** from `master`:
   ```sh
   git checkout -b feature/your-feature-name
   ```
   Use `feature/`, `fix/`, or `docs/` as a prefix when appropriate.

2. **Make your changes** and ensure the extension builds and runs in at least one browser.

3. **Commit** with clear messages:
   ```sh
   git add .
   git commit -m "Add brief description of your change"
   ```

4. **Push** to your fork:
   ```sh
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** against the **master** branch of the main repository.
   - Describe what you changed and why.
   - Reference any related issues (e.g. "Fixes #123").

6. **Wait for review.** Maintainers may request changes. Once approved, your PR can be merged.

### Versioning and Releases

This project uses [Release Please](https://github.com/googleapis/release-please) for versioning. Merged PRs that follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat: ...`, `fix: ...`) can influence the next release version. You do not need to bump the version in `package.json` yourself; the release workflow handles that when release PRs are merged.

---

## Questions?

- Open a [Discussion](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/discussions) or an [Issue](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues).
- See the [README](README.md) for usage and installation.

Thanks for contributing!
