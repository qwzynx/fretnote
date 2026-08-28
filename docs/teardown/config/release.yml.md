# `.github/workflows/release.yml`
**Role:** Tagged-release pipeline — desktop installers for four targets plus a signed Android APK.

**Trigger:** `push: tags: ['v*']`. Nothing runs on a normal push; there is no CI for tests or lint.

## `release-desktop` — the matrix
```yaml
matrix:
  include:
    - { platform: ubuntu-22.04,   args: '' }
    - { platform: windows-latest, args: '' }
    - { platform: macos-latest,   args: '--target aarch64-apple-darwin' }
    - { platform: macos-latest,   args: '--target x86_64-apple-darwin' }
```
**Four jobs, three OSes.** macOS appears twice because Apple Silicon and Intel need separate binaries — Tauri doesn't produce a universal binary here.

**`fail-fast: false`** — one platform failing doesn't cancel the others, so a Windows-only break still ships Linux and macOS builds.

**`ubuntu-22.04` pinned, not `ubuntu-latest`** — deliberate. WebKitGTK is `libwebkit2gtk-4.1` on 22.04; newer Ubuntu images changed the package, and glibc from a newer image would raise the minimum version for every user. **Pinning the *oldest* supported runner maximises binary compatibility.**

**The Linux dependency step** installs `libwebkit2gtk-4.1-dev` (the WebView from [`lib.rs`](../tauri/lib.rs.md)'s workaround), `libappindicator3-dev`, `librsvg2-dev`, and `patchelf` (needed for AppImage).

**`Swatinem/rust-cache@v2` with `workspaces: src-tauri -> target`** — caches the Rust build. Essential given [`Cargo.toml`](../tauri/Cargo.toml.md)'s `lto = true` + `codegen-units = 1`, which make a cold build take many minutes.

**`tauri-apps/tauri-action@v0`** does the whole build-and-upload, driven by [`tauri.conf.json`](../tauri/tauri.conf.json.md)'s `"targets": "all"`. **`releaseDraft: true`** — the release is created as a draft so it can be reviewed before publishing.

## `release-android`
**`needs: release-desktop`** — and the comment says why: *"The desktop jobs create the draft release; this job only adds the APK to it."*

Extra setup: JDK 17 (temurin), the Android SDK, **NDK `27.0.12077973` pinned to an exact version**, and four Rust targets (`aarch64`, `armv7`, `i686`, `x86_64` Android).

## The signing step — the most careful shell in the repo
> *"Android refuses to install an unsigned APK, so the artifact tauri produces is not directly usable."*

**`set -euo pipefail`** — exit on error, on unset variable, and on any pipeline failure.

**Four escalating validations, each with a specific `::error::` message:**
1. **Secret not set** → points at the README.
2. **`base64 -d` fails** → gives the exact command to fix it (`base64 -w0 … | gh secret set …`). Note `tr -d '[:space:]'` first: *"Tolerate wrapped/padded secrets"* — GitHub's UI can introduce newlines.
3. **Decoded to empty.**
4. **`keytool -list` fails** → *"Fails loudly on a wrong store password or a non-PKCS12 payload, rather than surfacing later as a confusing apksigner error."* It even prints the first 20 lines of the tool output, indented.

**This is defensive scripting done properly**: each failure mode gets its own detectable check and its own actionable message, rather than one opaque exit code twenty minutes into a release.

**`trap 'rm -f "$keystore"' EXIT`** — the decoded keystore is deleted on *any* exit path, including failure. A private key must not survive on the runner.

**`zipalign -p -f 4` then `apksigner sign` then `apksigner verify --print-certs`** — the standard Android release sequence, with verification so a silently-unsigned APK can't be uploaded.

## The upload
```yaml
# Uploads the asset only. Editing the release itself (name/draft/body) is
# left to the desktop jobs -- a PATCH from here is rejected with
# "Resource not accessible by integration" even with contents: write.
run: gh release upload "$GITHUB_REF_NAME" "fretnote-${GITHUB_REF_NAME}.apk" --clobber
```
**A documented GitHub Actions permission quirk.** `contents: write` allows uploading an asset but not PATCHing the release from a dependent job. Rather than fight it, the responsibilities are split — and the comment records why, so nobody tries to "simplify" it later.

**`--clobber`** makes a re-run idempotent.

**Related:** [`tauri/tauri.conf.json`](../tauri/tauri.conf.json.md), [`tauri/Cargo.toml`](../tauri/Cargo.toml.md), [`package.json`](package.json.md)
