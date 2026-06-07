#!/bin/bash
# Xiaoer VideoLab — auto-update the yt-dlp engine to the newest nightly.
# Run on a schedule by launchd (com.xiaoer.videolab.ytdlp-update). The daemon spawns
# yt-dlp fresh for every download, so a new binary is picked up with no restart.
#
# yt-dlp self-updates from GitHub Releases, which usually needs a proxy in mainland
# China — we point at the local Clash proxy but don't fail the box if it's off.

set -uo pipefail

NIGHTLY="$HOME/.local/bin/yt-dlp-nightly"
LOG="$HOME/Library/Logs/xiaoer-videolab-ytdlp-update.log"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

# macOS quirk: a stale SSL_CERT_FILE breaks curl/yt-dlp HTTPS.
unset SSL_CERT_FILE
# GitHub needs the proxy in CN; harmless if Clash is up, skipped-gracefully if not.
export HTTPS_PROXY="http://127.0.0.1:7890"
export HTTP_PROXY="http://127.0.0.1:7890"

{
  echo "[$TS] checking for yt-dlp nightly update…"
  if [[ -x "$NIGHTLY" ]]; then
    before="$("$NIGHTLY" --version 2>/dev/null)"
    if "$NIGHTLY" --update-to nightly 2>&1; then
      after="$("$NIGHTLY" --version 2>/dev/null)"
      if [[ "$before" != "$after" ]]; then
        echo "  ✓ updated: $before → $after"
      else
        echo "  · already latest ($after)"
      fi
    else
      echo "  ⚠ update failed (proxy down / GitHub unreachable) — will retry next run"
    fi
  else
    echo "  installing nightly binary for the first time…"
    curl -fL -o "$NIGHTLY" \
      https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp_macos \
      && chmod +x "$NIGHTLY" && echo "  ✓ installed $("$NIGHTLY" --version 2>/dev/null)" \
      || echo "  ⚠ install failed"
  fi
} >> "$LOG" 2>&1
