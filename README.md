# 看啥 · movie.zvector.top

打开就随机推荐一部 B 站能看的电影。片单来自视频置顶评论里 UP 主列的 33 部。

线上：https://movie.zvector.top

## 结构

网站和 Android app 是两份独立的实现，因为首屏预算完全不同：

```
public/                # 网站：手写单文件，首屏 ~124 KB
  index.html           # HTML + CSS + JS + 数据全在这一个文件里
  assets/covers/*.webp # 33 张竖版海报，480×640
  assets/bgs/*.webp    # 3 张横版大图（只有这 3 部有）
nsh/                   # Android app：Native Shell
  App.tsx              # 全部界面与逻辑
  App.test.tsx         # headless 测试
  movies.json          # 33 部影片数据（从 movies_detail.json 生成）
  assets/              # 同上的图
  nsh.json             # 应用 id、名称、外观
wrangler.toml          # Cloudflare Workers + 静态资源
*.py                   # 一次性数据采集脚本（解析置顶评论、解析短链、拉 PGC 元数据）
movies_detail.json     # 归一化后的 33 部影片元数据
links.json             # b23.tv 短链 → bangumi 播放页的映射
```

**为什么不合成一份**：NSH 的 web 产物要带 4.2 MB 的渲染引擎 wasm（压缩后 1 MB），
首屏从 124 KB 涨到 1 MB 以上。网页版只有几屏静态内容，不值得为它付这个代价；
Android 那边引擎是编进 apk 的，没有下载成本，所以用 NSH。

两边改的时候注意保持视觉和数据一致（`movies.json` 与 `index.html` 里的 `RAW` 数组同源）。

## 行为

- **随机不重复**：33 部洗牌成一轮，用完再重洗。
- **已看记录**：点「就看这个」标记已看，存 `localStorage`，右上角 `已看 n / 33`。
- **全部看完**：弹「这一单吃完了」，33 格金色方块，可「重新来一轮」。
- **键盘**：`空格` 换一部，`回车` 就去看。
- **触屏**：左右滑动换一部。
- **背景**：有横版图用横版图，没有就用海报模糊放大铺底。

## Android app

`nsh/` 是用 [Native Shell](https://nsh.dev) 写的 Android 版，同一套界面和数据。

```sh
cd nsh
nsh test                                     # headless 测试
./package-android.sh                         # .nsh/out/看啥.apk（21 MB）
nsh package App.tsx --target android --run   # 装到已连接的设备/启动，不裁剪（81 MB）
```

`package-android.sh` 把默认的 81 MB 压到 21 MB：只打 `arm64-v8a`（现代设备都是 arm64），
再把 `libnsh.so` 用 deflate 压进 APK，并把 manifest 的 `extractNativeLibs` 改成 `true`
让系统解压一次。冷启动时间和未压缩版持平。

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
`localStorage` 里，Android 上是应用自己的存储）；「就看这个」用 `openUrl` 交给系统浏览器。

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
