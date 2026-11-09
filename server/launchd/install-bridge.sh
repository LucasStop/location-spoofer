#!/bin/sh
# Instala o bridge como LaunchAgent. O launchd não lê ~/Downloads (TCC: "Operation not permitted"),
# então roda uma cópia em ~/Library/Application Support. Reexecutar após mudar server/index.js ou o token.
# O UDID vem de DEVICE_UDID em server/.env.local. O token vem de NEXT_PUBLIC_BRIDGE_TOKEN em app/.env.local (o mesmo que o front envia).
set -e
SRC=$(cd "$(dirname "$0")/.." && pwd)
DEST="$HOME/Library/Application Support/location-spoofer-bridge"
LABEL=com.locationspoofer.bridge
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"

TOKEN=$(grep '^NEXT_PUBLIC_BRIDGE_TOKEN=' "$SRC/../app/.env.local" | cut -d= -f2- | tr -d '"')
UDID=$(grep '^DEVICE_UDID=' "$SRC/.env.local" | cut -d= -f2- | tr -d '"')
[ -n "$UDID" ] || { echo "DEVICE_UDID vazio em server/.env.local"; exit 1; }
[ -n "$TOKEN" ] || { echo "NEXT_PUBLIC_BRIDGE_TOKEN vazio: bridge não sobe sem token"; exit 1; }

mkdir -p "$DEST"
cp "$SRC/index.js" "$SRC/package.json" "$SRC/launchd/run-bridge.sh" "$DEST/"
(cd "$DEST" && yarn install --production --silent)
(umask 077; printf "BRIDGE_TOKEN=%s\nDEVICE_UDID=%s\n" "$TOKEN" "$UDID" > "$DEST/bridge.env")

sed "s#__DEST__#$DEST#g" "$SRC/launchd/$LABEL.plist" > "$AGENT"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "bridge instalado em $DEST"
