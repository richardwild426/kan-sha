#!/bin/sh
# 打一个尽量小的 Android APK。
#
# 默认 `nsh package --target android` 出 81 MB：
#   - lib/arm64-v8a 和 lib/armeabi-v7a 各带一份 libnsh.so（48.9 MB + 33.5 MB）
#   - .so 是 Stored（不压缩），因为 manifest 里 extractNativeLibs=false
#
# 两步缩小：
#   1. 只打 arm64-v8a（现代 Android 设备都是 arm64）                 → 49 MB
#   2. .so 用 deflate 压进 APK，manifest 的 extractNativeLibs 改 true → 21 MB
#
# 加 --trim 再走第三步：按 app 实际 import 的模块现场编译一个裁剪版
# 运行时（NSH #1878 / #2060），把 shader/editor/highlight/math/plot/
# term/emoji-picker/svg/zlib/crypto/websocket/updater 全部排除 → 13 MB。
# 需要 cargo、Rust 的 aarch64-linux-android target 和 Android NDK，
# 首次编译约 2 分钟。构建失败时自动退回预编译运行时。
#
# 用法：./package-android.sh [--trim] [输出路径]
set -eu

TRIM=0
if [ "${1:-}" = "--trim" ]; then TRIM=1; shift; fi
OUT=${1:-.nsh/out/看啥.apk}

JAVA_HOME=${JAVA_HOME:-$HOME/.local/jdk/jdk-21.0.13+9/Contents/Home}
ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
NDK=${ANDROID_NDK_HOME:-$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | tail -1)}
# build-tools 版本随 runner 的镜像变，挑最新的
BT=$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1)
export JAVA_HOME ANDROID_HOME
PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export PATH

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "→ nsh package (arm64-v8a only)"
VER_ARGS=""
[ -n "${APP_VERSION:-}" ] && VER_ARGS="--app-version $APP_VERSION"
[ -n "${BUILD_NUMBER:-}" ] && VER_ARGS="$VER_ARGS --build $BUILD_NUMBER"
# shellcheck disable=SC2086
nsh package App.tsx --target android --abi arm64-v8a $VER_ARGS -o "$tmp/raw" >"$tmp/pack.log" 2>&1 || {
  cat "$tmp/pack.log"; exit 1; }
raw=$(ls "$tmp/raw"/*.apk)

mkdir "$tmp/x"
(cd "$tmp/x" && unzip -q "$raw")

# 裁剪要 .nsh/rust（nsh 生成的 crate 骨架）。0.5.1 及更早不写这个目录，
# 但带裁剪逻辑的构建（main / nightly）会在 package 时生成它，所以没有就
# 先用同一个 nsh 正常打一次包，它顺手把骨架写下来。
if [ "$TRIM" = 1 ] && [ ! -d .nsh/rust/android ]; then
  echo "→ 先打一次包，让 nsh 生成 .nsh/rust 骨架"
  if ! nsh package App.tsx --target android --abi arm64-v8a -o "$tmp/gen" >"$tmp/gen.log" 2>&1; then
    cat "$tmp/gen.log"; exit 1
  fi
fi

if [ "$TRIM" = 1 ] && [ ! -d .nsh/rust/android ]; then
  echo "  注意：这个 NSH 版本不生成 .nsh/rust，跳过裁剪（得到预编译运行时版）"
  echo "        13 MB 需要带裁剪逻辑的 nsh（main 分支 / nightly）"
fi

if [ "$TRIM" = 1 ] && [ -d .nsh/rust/android ] && command -v cargo >/dev/null 2>&1; then
  echo "→ 编译裁剪版运行时（只留 JS 引擎，无 highlight/math/svg/crypto/…）"
  NDKBIN=$(ls -d "$NDK"/toolchains/llvm/prebuilt/*/bin 2>/dev/null | head -1)
  CC="$NDKBIN/aarch64-linux-android26-clang"
  # 只留 js：desktop-only 的 net 和本版本 crates.io 还没有的 svg 都不能要求
  python3 - "$PWD/.nsh/rust" <<'PY'
import re, pathlib, sys
root = pathlib.Path(sys.argv[1])
ws = root / 'Cargo.toml'
s = ws.read_text()
ws.write_text(re.sub(r'^members = \[.*?\]$', 'members = ["android"]', s, flags=re.M))
ac = root / 'android' / 'Cargo.toml'
s = ac.read_text()
s = re.sub(r'^default = \[.*?\]$', 'default = ["js"]', s, flags=re.M)
for f in ('svg', 'net', 'websocket', 'updater'):
    s = re.sub(r'^%s = \[.*?\]\n' % f, '', s, flags=re.M)
ac.write_text(s)
PY
  # quickjs-jit-sys 用 bindgen 生成绑定，bindgen 不知道 NDK 的 sysroot，
  # 会去摸宿主的 /usr/include 然后找不到 bits/libc-header-start.h。
  # 带版本号的 triple（android26）+ --sysroot 一起显式告诉它。
  SYSROOT=$(dirname "$NDKBIN")/sysroot
  BINDGEN_ARGS="--target=aarch64-linux-android26 --sysroot=$SYSROOT"
  if ( cd .nsh/rust && \
       CC_aarch64_linux_android="$CC" \
       CXX_aarch64_linux_android="${CC}++" \
       AR_aarch64_linux_android="$NDKBIN/llvm-ar" \
       CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$CC" \
       BINDGEN_EXTRA_CLANG_ARGS_aarch64_linux_android="$BINDGEN_ARGS" \
       BINDGEN_EXTRA_CLANG_ARGS="$BINDGEN_ARGS" \
       PATH="$NDKBIN:$PATH" \
       cargo build --release --target aarch64-linux-android \
         -p nsh-app--android --no-default-features --features js \
         >"$tmp/cargo.log" 2>&1 ); then
    so=.nsh/rust/target/aarch64-linux-android/release/libnsh_app__android.so
    "$NDKBIN/llvm-strip" --strip-unneeded "$so" -o "$tmp/x/lib/arm64-v8a/libnsh.so"
    echo "  裁剪版 .so: $(ls -lh "$tmp/x/lib/arm64-v8a/libnsh.so" | awk '{print $5}')"
  else
    echo "  warn: 裁剪版编译失败，用预编译运行时"; tail -5 "$tmp/cargo.log" | sed 's/^/    /'
  fi
fi

echo "→ 改 manifest：extractNativeLibs=true"
python3 - "$tmp/x/AndroidManifest.xml" <<'PY'
import struct, sys
p = sys.argv[1]
d = bytearray(open(p, 'rb').read())
_, hs, _ = struct.unpack_from('<HHI', d, 8)
count, _, flags, start, _ = struct.unpack_from('<IIIII', d, 16)
offs = [struct.unpack_from('<I', d, 8 + hs + i * 4)[0] for i in range(count)]
names = []
for i in range(count):
    b = 8 + start + offs[i]
    if flags & 0x100:
        n = d[b]
        q = b + 2 if n & 0x80 else b + 1
        names.append(d[q:d.index(b'\0', q)].decode('utf-8', 'replace'))
    else:
        q = b + 2
        n = struct.unpack_from('<H', d, b)[0]
        if n & 0x8000:
            q += 2
            n = struct.unpack_from('<H', d, b + 2)[0]
        names.append(d[q:q + n * 2].decode('utf-16-le', 'replace'))
target = names.index('extractNativeLibs')
for off in range(8, len(d) - 40, 4):
    if struct.unpack_from('<HHI', d, off)[0] != 0x0102:
        continue
    a_start, a_size, a_count = struct.unpack_from('<HHH', d, off + 24)
    base = off + 16 + a_start
    for i in range(a_count):
        a = base + i * a_size
        if a + 20 > len(d):
            break
        if struct.unpack_from('<III', d, a)[1] == target:
            # rawValue 与 typed data 都要改，只改一个的话 dump 说 true 但行为还是 false
            struct.pack_into('<I', d, a + 8, 0xFFFFFFFF)
            struct.pack_into('<I', d, a + 16, 0xFFFFFFFF)
            open(p, 'wb').write(d)
            sys.exit(0)
sys.exit('extractNativeLibs 属性没找到')
PY

echo "→ 重打包：.so deflate，resources.arsc 必须 Stored"
python3 - "$tmp/x" "$tmp/packed.apk" <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
# Android R+ 硬要求 resources.arsc 不压缩且 4 字节对齐；签名文件同样 Stored
STORED = {'resources.arsc'}
with zipfile.ZipFile(out, 'w') as z:
    for root, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(root, f)
            arc = os.path.relpath(p, src)
            if f in STORED or f.endswith(('.RSA', '.SF', '.MF')):
                z.write(p, arc, compress_type=zipfile.ZIP_STORED)
            else:
                z.write(p, arc, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
PY

echo "→ zipalign + 签名"
"$BT/zipalign" -f -p 4 "$tmp/packed.apk" "$tmp/aligned.apk"
mkdir -p "$(dirname "$OUT")"

# 发版用 NSH_KEYSTORE 指向的 release key；日常构建退回本机 debug key。
# 两者不能混用：换签名后已装的旧版本无法覆盖升级，只能先卸载。
if [ -n "${NSH_KEYSTORE:-}" ]; then
  "$BT/apksigner" sign --ks "$NSH_KEYSTORE" \
    --ks-pass "pass:$NSH_KEYSTORE_PASSWORD" --key-pass "pass:$NSH_KEYSTORE_PASSWORD" \
    --ks-key-alias "${NSH_KEY_ALIAS:-kansha}" --out "$OUT" "$tmp/aligned.apk"
else
  echo "  (debug key — 仅自用测试，不要发给别人装)"
  "$BT/apksigner" sign --ks "$HOME/.android/debug.keystore" \
    --ks-pass pass:android --key-pass pass:android \
    --ks-key-alias androiddebugkey --out "$OUT" "$tmp/aligned.apk"
fi

printf '%s: %s\n' "$OUT" "$(ls -lh "$OUT" | awk '{print $5}')"
