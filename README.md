# 看啥 · movie.zvector.top

打开就随机推荐一部 B 站能看的电影。片单来自视频置顶评论里 UP 主列的 33 部。

线上：https://movie.zvector.top

## 结构

网站和手机 app 是两份独立的实现，因为首屏预算完全不同：

```
public/                # 网站：手写单文件，首屏 ~124 KB
  index.html           # HTML + CSS + JS + 数据全在这一个文件里
  assets/covers/*.webp # 33 张竖版海报，480×640
  assets/bgs/*.webp    # 3 张横版大图（只有这 3 部有）
nsh/                   # Android + iOS app：Native Shell
  App.tsx              # 全部界面与逻辑
  App.test.tsx         # headless 测试
  movies.json          # 33 部影片数据（从 movies_detail.json 生成）
  assets/              # 同上的图
  icon.png             # 1024×1024 应用图标
  nsh.json             # 应用 id、名称、外观、权限
  package-android.sh   # 出精简 APK
  package-ios.sh       # 出 ipa（iPhone + iPad）
wrangler.toml          # Cloudflare Workers + 静态资源
*.py                   # 一次性数据采集脚本（解析置顶评论、解析短链、拉 PGC 元数据）
movies_detail.json     # 归一化后的 33 部影片元数据
links.json             # b23.tv 短链 → bangumi 播放页的映射
```

**为什么不合成一份**：NSH 的 web 产物要带 4.2 MB 的渲染引擎 wasm（压缩后 1 MB），
首屏从 124 KB 涨到 1 MB 以上。网页版只有几屏静态内容，不值得为它付这个代价；
手机那边引擎是编进安装包的，没有下载成本，所以用 NSH。

两边改的时候注意保持视觉和数据一致（`movies.json` 与 `index.html` 里的 `RAW` 数组同源）。

## 行为

- **随机不重复**：33 部洗牌成一轮，用完再重洗。
- **已看记录**：点「就看这个」标记已看，存 `localStorage`，右上角 `已看 n / 33`。
- **全部看完**：弹「这一单吃完了」，33 格金色方块，可「重新来一轮」。
- **键盘**：`空格` 换一部，`回车` 就去看。
- **触屏**：左右滑动换一部。
- **背景**：有横版图用横版图，没有就用海报模糊放大铺底。

## 手机 app（Android + iOS）

`nsh/` 是用 [Native Shell](https://nsh.dev) 写的一份代码，同时出 Android 和 iOS，
同一套界面和数据。

```sh
cd nsh
nsh test                                     # headless 测试
./package-android.sh                         # .nsh/out/看啥.apk（21 MB）
./package-android.sh --trim                  # 同上，再现场编译裁剪版运行时（13 MB）
nsh package App.tsx --target android --run   # 装到已连接的设备/启动，不裁剪（81 MB）
./package-ios.sh                             # dist/kansha.ipa（未签名）
```

`package-android.sh` 把默认的 81 MB 压到 21 MB：只打 `arm64-v8a`（现代设备都是 arm64），
再把 `libnsh.so` 用 deflate 压进 APK，并把 manifest 的 `extractNativeLibs` 改成 `true`
让系统解压一次。冷启动时间和未压缩版持平。

`--trim` 再省 8 MB，到 13 MB：按 app 实际 import 的模块现场编译一个只含 JS 引擎的
运行时（[NSH #1878](https://github.com/longbridge/nsh/issues/1878) / #2060），
把 `shader`、`editor`、`highlight`、`math`、`plot`、`term`、`emoji-picker`、`svg`、
`zlib`、`crypto`、`websocket`、`updater` 全部排除。需要 cargo、Rust 的
`aarch64-linux-android` target 和 Android NDK（首次编译约 2 分钟）；失败会自动退回
预编译运行时，不影响出包。

> 为什么不是 `nsh package` 自己裁：裁剪逻辑（`native_features.rs`）只存在于 0.5.1
> 之后的 `main`（11-15 合入）。0.5.1 不生成 cargo 工作区，所以脚本自己带了一份
> （`runtime/`），并把它改成只保留 android 成员、只要求 `js` —— main 生成的模板会要求
> crates.io 上还不存在的 `svg`/`net`/`websocket`/`updater` feature，直接解析失败。

需要 NSH 0.5.1 或更新。0.5.0 起 web 构建只链接用到的 `nsh/base` core、crypto 和 URL
（[#1039](https://github.com/longbridge/nsh/issues/1039) 的后续，[#1220](https://github.com/longbridge/nsh/pull/1220)），
APK 里引擎从 4.2 MB 降到 3.8 MB。

（也能 `nsh package --target web` 出网页版，但引擎 wasm 会让首屏涨到 1 MB 以上，
所以网站不用它。）

Android 构建需要 JDK 和 Android SDK：

```sh
export JAVA_HOME=/Users/zvector/.local/jdk/jdk-21.0.13+9/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

跟网页版的差别：布局由 NSH 的 Rust 核心算（Taffy），不用 CSS 媒体查询；已看记录走 `Storage`（web 上落在
`localStorage` 里，手机上是应用自己的存储）；「就看这个」用 `openUrl` 交给系统浏览器。

### iPad

`platform.idiom === "pad"` 时卡片放宽到 720（手机 560）、海报 168 宽、字号各涨 2–7 pt，
整块内容垂直居中而不是贴底 —— 不然在 11 寸屏上全挤在下面一条。

底部提示按 `platform.desktop` 切换：桌面/网页是「空格 换一部 · 回车 就去看」，
手机和平板是「左右滑动换一部」。

### iOS 打包

`package-ios.sh` 只在 macOS 上跑，要完整 Xcode（`actool` 编图标、`codesign` 签名）。
本机没装，所以这条路平时不用，全靠 CI 的 `macos-latest`。

iOS 的权限在 `nsh.json` 的 `capabilities` 里收窄了：只给 `openUrl`（https）和 `statusBar`。
不写 `capabilities` 的话 NSH 会按默认给你塞麦克风和语音识别的权限描述 —— 这个 app 一个都不用。

## 发版

安装包由 GitHub Actions 出，挂在 [Releases](https://github.com/richardwild426/kan-sha) 上。

```sh
git tag v1.0.2
git push origin v1.0.2
```

打 tag 后 `.github/workflows/release.yml` 起两个并行 job，再合成一个 Release：

| 平台 | job | 产物 |
|---|---|---|
| Android | `android`（ubuntu） | `kansha-<版本>-arm64.apk`，12.9 MiB |
| iOS | `ios`（macOS） | `kansha-<版本>.ipa`，21 MB，iPhone + iPad |

- **版本号**取自 tag（`v1.0.2` → `versionName=1.0.2`），`versionCode`/`build` 用
  `github.run_number` 递增 —— 手机靠它判断能不能覆盖安装，所以必须每次都涨。
- 也能在 Actions 页面手动 `Run workflow` 填版本号，但不建 Release，只留 artifact。
- 附件名用 ASCII：`action-gh-release` 会把中文文件名吃掉（`看啥-1.0.0-arm64.apk` 变成
  `-1.0.0-arm64.apk`），所以发布资产叫 `kansha-*`。

### Android 签名

**证书不在仓库里**，放在 Secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、
`ANDROID_KEY_ALIAS`。证书丢了就没法覆盖升级，只能让用户卸载重装 —— 务必备份。

### iOS 签名

iOS 包只能在 macOS 上打：图标要 Xcode 的 `actool` 编进 `Assets.car`，签名要 `codesign`。
本机没装 Xcode，所以 iOS 完全靠 CI 的 `macos-latest` 跑。

默认出的是**未签名 ipa**：App Store 装不了，用 Sideloadly / AltStore 拿自己的 Apple ID
签一次（免费 ID 证书 7 天失效，到期重签，app 数据不丢）。想长期用或分发，把这三样加进
Secrets，workflow 会自动切到正式签名：

| Secret | 内容 |
|---|---|
| `APPLE_CERT_P12_BASE64` | 导出的 `.p12`（Apple Development 或 Distribution 证书），base64 |
| `APPLE_CERT_PASSWORD` | `.p12` 的密码 |
| `APPLE_PROFILE_BASE64` | `.mobileprovision`，base64 |

三个缺任何一个就走未签名，不会失败。

一个 ipa 同时覆盖 iPhone 和 iPad（`UIDeviceFamily: [1, 2]`），最低 iOS 15。
CI 会把它装进 iPhone 和 iPad 两个模拟器各截一张图，作为 `ios-shots` artifact ——
这是唯一能验证 iPad 布局（`platform.idiom === "pad"` 分支）的办法。

### 为什么 CI 能出 13 MB

### 为什么 CI 能出 13 MB

`nsh/runtime/` 存了一份 cargo 工作区（nsh 生成的 crate 骨架，pin `=0.5.0` 的 crate）。
0.5.1 自己不会写这个目录，脚本用这份骨架现场交叉编译一个只含 JS 引擎的运行时，
替换掉预编译的 `libnsh.so`（47 MB → 27 MB，deflate 后 13 MB）。

> **必须用正式版 NSH。** nightly 的 `classes.dex` 已经用新协议，而 crates.io 上的 crate
> 还是旧的，编出来的 `.so` 串不上，装上去一启动就
> `ArrayIndexOutOfBoundsException: length=13; index=38`（`Mounter.string`）。
> 脚本检测到预发布版本会直接跳过裁剪，避免打出这种坏包。

## 部署

Cloudflare Workers 静态资源，`wrangler.toml` 里声明自定义域名。

```bash
wrangler deploy
```

改完 `public/` 重新 deploy 即可，秒级生效。`public/_headers` 里 `index.html` 每次校验、
`assets/` 缓存一周（图片文件名不带哈希，所以不能 immutable）。

## 素材来源

B 站 PGC 接口（`api.bilibili.com/pgc/view/web/season`）。图片已本地化为 WebP，不依赖 B 站 CDN 防盗链。

B 站接口的原始返回（含其他用户的 uid、昵称、头像地址）不入库，见 `.gitignore`。
