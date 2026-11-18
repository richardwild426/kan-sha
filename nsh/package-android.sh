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

# 裁剪要一个 cargo 工作区（nsh 生成的东西）。0.5.1 不写 .nsh/rust，所以
# runtime/ 里存了一份（由 nsh 0.5.1 生成，pin =0.5.0 的 crate），没有就用它。
if [ "$TRIM" = 1 ] && [ ! -d .nsh/rust/android ] && [ -d runtime/android ]; then
  echo "→ 用 runtime/ 里的骨架建工作区"
  mkdir -p .nsh/rust
  cp -R runtime/android .nsh/rust/android
  cp runtime/workspace.toml .nsh/rust/Cargo.toml
fi

# 硬约束：classes.dex 读 libnsh.so 的字符串表，两边协议必须对得上。
# crates.io 落后于 main，所以用 nightly（dex 已是新协议）配 crates.io 编出来的
# .so，装上去一启动就崩：ArrayIndexOutOfBounds length=13; index=38
# （Mounter.string）。这种坏包比大 8 MB 糟得多，直接拒绝裁剪。
# 正式版（如 0.5.1）配 crates.io 的 0.5.0 .so 是验证过能跑的，允许。
if [ "$TRIM" = 1 ] && [ -d .nsh/rust/android ] && command -v cargo >/dev/null 2>&1; then
  case $(nsh --version) in
    *nightly* | *dev*)
      echo "  warn: 这个 nsh 是预发布构建，dex 与 crates.io 的 crate 协议不一致，跳过裁剪"
      echo "        要 13 MB 的包只能等正式版支持现场编译运行时"
      TRIM=0 ;;
  esac
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

echo "→ 修图标：补 adaptive icon（NSH 只出一张 192px legacy PNG）"
# 不补的话 Android 8+ 会把它塞进圆形遮罩再垫一块系统色底板：
# 实测金色标只剩 68/247 px，四周一圈灰，就是「丑」的来源。
# 做法：用 aapt2 单独 link 一份只含图标资源的 apk，再把它里面的
# resources.arsc 和 res/ 拷回主包 —— manifest 与代码保持 NSH 原样。
ICON_SRC="$(dirname "$0")/icon.png"
if [ -f "$ICON_SRC" ]; then
  ICON_TMP="$tmp/icon"
  mkdir -p "$ICON_TMP"
  # 有 Pillow 的 python 优先；没有就借 uv 临时装一个（CI 上两者都不一定在）。
  # 解析出来的层是仓库里的文件，打包完就删，不进版本库。
  GEN="$(dirname "$0")/icon/make_android.py"
  run_gen() {
    if python3 -c 'import PIL' >/dev/null 2>&1; then
      python3 "$GEN" "$ICON_TMP"
    elif command -v uv >/dev/null 2>&1; then
      uv run --with pillow python "$GEN" "$ICON_TMP"
    else
      return 1
    fi
  }
  if run_gen >"$ICON_TMP/gen.log" 2>&1; then
    cat > "$ICON_TMP/AndroidManifest.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="top.zvector.kansha">
  <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35" />
  <application android:icon="@mipmap/ic_launcher" />
</manifest>
XML
    # NSH 编出来的 manifest 里 application:icon 是硬写死的资源 ID
    # 0x7f010000。新资源表如果让 drawable 抢占 01 类型，那个 ID 就指到
    # 背景层去了（图标变成一块纯黑）。用 --stable-ids 把 mipmap/ic_launcher
    # 钉回 0x7f010000，drawable 排到 02 之后。
    printf 'top.zvector.kansha:mipmap/ic_launcher = 0x7f010000\ntop.zvector.kansha:drawable/ic_launcher_background = 0x7f020000\ntop.zvector.kansha:drawable/ic_launcher_foreground = 0x7f020001\n' \
      > "$ICON_TMP/stable-ids.txt"
    # aapt2 link 只吃编译过的 .flat，先整个 res/ 编一遍。
    if "$BT/aapt2" compile --dir "$ICON_TMP/res" -o "$ICON_TMP/compiled.zip" \
         >"$ICON_TMP/compile.log" 2>&1 \
       && "$BT/aapt2" link -o "$ICON_TMP/icons.apk" \
         -I "$ANDROID_HOME/platforms/android-35/android.jar" \
         --manifest "$ICON_TMP/AndroidManifest.xml" \
         --min-sdk-version 26 --target-sdk-version 35 \
         --stable-ids "$ICON_TMP/stable-ids.txt" \
         "$ICON_TMP/compiled.zip" \
         >"$ICON_TMP/link.log" 2>&1; then
      # 拆出资源表与 res/，覆盖主包里那份单图标的旧资源。
      mkdir -p "$ICON_TMP/out"
      (cd "$ICON_TMP/out" && unzip -qo "$ICON_TMP/icons.apk" 'resources.arsc' 'res/*')
      rm -rf "$tmp/x/res"
      cp "$ICON_TMP/out/resources.arsc" "$tmp/x/resources.arsc"
      cp -R "$ICON_TMP/out/res" "$tmp/x/res"
      layers=$(find "$tmp/x/res" -name 'ic_launcher_foreground.png' | wc -l | tr -d ' ')
      echo "  ok: adaptive icon 已注入（$layers 档前景层）"
    else
      echo "  warn: aapt2 link 失败，保留原图标"
      head -5 "$ICON_TMP/link.log"
    fi
  else
    echo "  warn: 生成图标资源失败，保留原图标"
    head -5 "$ICON_TMP/gen.log"
  fi
else
  echo "  warn: 没找到 icon.png，保留原图标"
fi

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
