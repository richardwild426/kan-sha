#!/bin/sh
# 打 iOS 包：一个 ipa 同时装 iPhone 和 iPad（UIDeviceFamily 1,2）。
#
# 两条路：
#   有 Apple 签名材料   → 出签名 ipa，可直接装设备/传 TestFlight
#     需要 NSH_SIGN_IDENTITY（如 "Apple Development: Jane Doe (ABCDE12345)"）
#     和 NSH_PROFILE（.mobileprovision 路径）
#   没有                → 出未签名 ipa，用 Sideloadly / AltStore 之类自签安装
#     （免费 Apple ID 签的证书 7 天失效，到期重签一次即可）
#
# 需要 macOS + Xcode：图标要 actool 编译进 Assets.car，签名要 codesign。
#
# 用法：./package-ios.sh [输出路径]      默认 dist/kansha.ipa
set -eu

OUT=${1:-dist/kansha.ipa}

if [ "$(uname -s)" != "Darwin" ]; then
  echo "iOS 包只能在 macOS 上打（要 Xcode 的 actool / codesign）" >&2
  exit 1
fi
if ! xcrun --find actool >/dev/null 2>&1; then
  echo "找不到 actool：需要完整 Xcode 并把 xcode-select 指过去" >&2
  echo "  sudo xcode-select -s /Applications/Xcode.app" >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 参数用 set -- 攒，身份字符串里有空格，不能拼成字符串再用
set -- App.tsx --target ios -o "$tmp/out"
[ -n "${APP_VERSION:-}" ] && set -- "$@" --app-version "$APP_VERSION"
[ -n "${BUILD_NUMBER:-}" ] && set -- "$@" --build "$BUILD_NUMBER"

SIGNED=0
if [ -n "${NSH_SIGN_IDENTITY:-}" ] && [ -n "${NSH_PROFILE:-}" ]; then
  SIGNED=1
  set -- "$@" --sign "$NSH_SIGN_IDENTITY" --profile "$NSH_PROFILE"
  echo "→ nsh package（签名：$NSH_SIGN_IDENTITY）"
else
  echo "→ nsh package（未签名，装设备需自签）"
fi

nsh package "$@" >"$tmp/pack.log" 2>&1 || {
  cat "$tmp/pack.log"; exit 1; }

mkdir -p "$(dirname "$OUT")"

if [ "$SIGNED" = 1 ]; then
  ipa=$(ls "$tmp/out"/*.ipa 2>/dev/null | head -1 || true)
  if [ -z "$ipa" ]; then
    echo "没生成 ipa，打包日志：" >&2; cat "$tmp/pack.log"; exit 1
  fi
  cp "$ipa" "$OUT"
else
  # 未签名时 nsh 只给 .app，自己包成 ipa（Payload/<X>.app）。
  # 目录名用 ASCII：中文进 zip 容易编码错乱；App 显示名来自
  # Info.plist 的 CFBundleDisplayName，和目录名无关。
  app=$(ls -d "$tmp/out"/*.app 2>/dev/null | head -1 || true)
  if [ -z "$app" ]; then
    echo "没生成 .app，打包日志：" >&2; cat "$tmp/pack.log"; exit 1
  fi
  mkdir -p "$tmp/Payload"
  cp -R "$app" "$tmp/Payload/Kansha.app"
  ( cd "$tmp" && zip -qry kansha.ipa Payload )
  cp "$tmp/kansha.ipa" "$OUT"
fi

# 校验 iPhone + iPad 都在
unzip -p "$OUT" 'Payload/*/Info.plist' > "$tmp/plist" 2>/dev/null || true
if [ -s "$tmp/plist" ]; then
  python3 - "$tmp/plist" <<'PY'
import plistlib, sys
d = plistlib.load(open(sys.argv[1], 'rb'))
fam = [int(x) for x in d.get('UIDeviceFamily', [])]
name = d.get('CFBundleDisplayName', '?')
print(f"  {name} {d.get('CFBundleShortVersionString')} ({d.get('CFBundleVersion')})"
      f"  min iOS {d.get('MinimumOSVersion')}")
print(f"  UIDeviceFamily: {fam}" + ("  → iPhone + iPad" if 1 in fam and 2 in fam else "  ← 缺 iPad!"))
PY
fi

printf '%s: %s\n' "$OUT" "$(ls -lh "$OUT" | awk '{print $5}')"
