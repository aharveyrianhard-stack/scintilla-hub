#!/bin/bash
# Builds Scintilla.app next to this file. Run on the MacBook; the iMac gets a copy of the bundle.
set -e; cd "$(dirname "$0")"; OUT=build/Scintilla.app; rm -rf build; mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"
swiftc -O -o "$OUT/Contents/MacOS/Scintilla" Scintilla.swift -framework AppKit -framework WebKit
cp Info.plist "$OUT/Contents/Info.plist"
cp urth.png "$OUT/Contents/Resources/urth.png"
ICON="${ICON_SRC:-/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy/icon-512.png}"; S=build/AppIcon.iconset; mkdir -p "$S"
for n in 16 32 128 256 512; do sips -z $n $n "$ICON" --out "$S/icon_${n}x${n}.png" >/dev/null; done
for n in 16 32 128 256; do sips -z $((n*2)) $((n*2)) "$ICON" --out "$S/icon_${n}x${n}@2x.png" >/dev/null; done
iconutil -c icns "$S" -o "$OUT/Contents/Resources/AppIcon.icns"
codesign --force --deep --sign - "$OUT"
echo "built $OUT"
