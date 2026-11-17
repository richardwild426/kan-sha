# 看啥 · movie.zvector.top

打开就随机推荐一部 B 站能看的电影。片单来自视频置顶评论里 UP 主列的 33 部。

线上：https://movie.zvector.top

## 结构

```
nsh/                   # 源码：Native Shell，一份代码出 web / Android
  App.tsx              # 全部界面与逻辑
  App.test.tsx         # headless 测试
  movies.json          # 33 部影片数据（从 movies_detail.json 生成）
  assets/              # 33 张海报 + 3 张横图（webp）
  nsh.json             # 应用 id、名称、外观
public/                # 部署用：nsh package --target web 的产物，不要手改
legacy/                # 最早那版手写单文件网页，留档（已不在线上）
wrangler.toml          # Cloudflare Workers + 静态资源
*.py                   # 一次性数据采集脚本（解析置顶评论、解析短链、拉 PGC 元数据）
movies_detail.json     # 归一化后的 33 部影片元数据
links.json             # b23.tv 短链 → bangumi 播放页的映射
```

改界面改 `nsh/App.tsx`，然后重新打包、`cp` 进 `public/`。`nsh/` 需要 [Native Shell](https://nsh.dev) 的 `nsh` 命令。

## 行为

- **随机不重复**：33 部洗牌成一轮，用完再重洗。
- **已看记录**：点「就看这个」标记已看，存 `localStorage`，右上角 `已看 n / 33`。
- **全部看完**：弹「这一单吃完了」，33 格金色方块，可「重新来一轮」。
- **键盘**：`空格` 换一部，`回车` 就去看。
- **触屏**：左右滑动换一部。
- **背景**：有横版图用横版图，没有就用海报模糊放大铺底。

## Native Shell 版

`nsh/` 是用 [Native Shell](https://nsh.dev) 重写的同一套界面，一份代码出 web 和 Android。

```sh
cd nsh
nsh run App.tsx --target web                 # 本地开发服务器
nsh package --target web                     # 静态站点，产物在 .nsh/out/看啥/

nsh package App.tsx --target android         # .nsh/out/看啥.apk
nsh package App.tsx --target android --run   # 装到已连接的设备/模拟器并启动
```

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
cd nsh && nsh package --target web --out dist
cd .. && rm -rf public/* && cp -R "nsh/dist/看啥/." public/
cp nsh/_headers public/
wrangler deploy
```

`public/_headers` 给 Cloudflare 的规则：wasm 以 `application/wasm` 下发（浏览器才能边下边编译），
带内容哈希的文件一年 immutable，`index.html` 每次校验。

## 素材来源

B 站 PGC 接口（`api.bilibili.com/pgc/view/web/season`）。图片已本地化为 WebP，不依赖 B 站 CDN 防盗链。

B 站接口的原始返回（含其他用户的 uid、昵称、头像地址）不入库，见 `.gitignore`。
