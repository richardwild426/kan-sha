#!/bin/sh
# 打一个尽量小的 Android APK。
#
# 默认 `nsh package --target android` 出 81 MB：
#   - lib/arm64-v8a 和 lib/armeabi-v7a 各带一份 libnsh.so（48.9 MB + 33.5 MB）
#   - .so 是 Stored（不压缩），因为 manifest 里 extractNativeLibs=false
#
# 这里做两件事：
#   1. 只打 arm64-v8a（现代 Android 设备都是 arm64）
#   2. 把 .so 用 deflate 压进 APK，并把 manifest 的 extractNativeLibs 改成 true
# 结果约 21 MB，冷启动时间和未压缩版一致（系统解压一次后缓存）。
#
# 用法：./package-android.sh [输出路径]
set -eu

OUT=${1:-.nsh/out/看啥.apk}
JAVA_HOME=${JAVA_HOME:-$HOME/.local/jdk/jdk-21.0.13+9/Contents/Home}
ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
BT="$ANDROID_HOME/build-tools/35.0.1"
export JAVA_HOME ANDROID_HOME
PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export PATH

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "→ nsh package (arm64-v8a only)"
nsh package App.tsx --target android --abi arm64-v8a -o "$tmp/raw"

raw=$(ls "$tmp/raw"/*.apk)
echo "→ 解包并改 manifest：extractNativeLibs=true"
mkdir "$tmp/x"
(cd "$tmp/x" && unzip -q "$raw")

# extractNativeLibs=false → true：在二进制 AXML 里把该属性的 data 和 rawValue 都改成 -1
python3 - "$tmp/x/AndroidManifest.xml" <<'PY'
import struct, sys
p = sys.argv[1]
d = bytearray(open(p, 'rb').read())

# 字符串池：找到 "extractNativeLibs" 的索引
_, hs, _ = struct.unpack_from('<HHI', d, 8)
count, _, flags, strings_start, _ = struct.unpack_from('<IIIII', d, 16)
offs = [struct.unpack_from('<I', d, 8 + hs + i * 4)[0] for i in range(count)]
names = []
for i in range(count):
    b = 8 + strings_start + offs[i]
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

# 所有 START_ELEMENT 里找这个属性
for off in range(8, len(d) - 40, 4):
    t, _, _ = struct.unpack_from('<HHI', d, off)
    if t != 0x0102:
        continue
    attr_start, attr_size, attr_count = struct.unpack_from('<HHH', d, off + 24)
    base = off + 16 + attr_start
    for i in range(attr_count):
        a = base + i * attr_size
        if a + 20 > len(d):
            break
        _, aname, _ = struct.unpack_from('<III', d, a)
        if aname == target:
            struct.pack_into('<I', d, a + 8, 0xFFFFFFFF)   # rawValue = true
            struct.pack_into('<I', d, a + 16, 0xFFFFFFFF)  # typed data = true
            open(p, 'wb').write(d)
            sys.exit(0)
sys.exit('extractNativeLibs 属性没找到')
PY

echo "→ 重打包：.so deflate，resources.arsc 必须 Stored"
python3 - "$tmp/x" "$tmp/packed.apk" <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
# Android R+ 要求 resources.arsc 不压缩且 4 字节对齐；签名文件同样 Stored
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
KS=$HOME/.android/debug.keystore
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey --out "$OUT" "$tmp/aligned.apk"

printf '%s: %s\n' "$OUT" "$(ls -lh "$OUT" | awk '{print $5}')"
