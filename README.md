# 看啥 · movie.zvector.top

打开就随机推荐一部 B 站能看的电影。片单来自视频置顶评论里 UP 主列的 33 部。

线上：https://movie.zvector.top

## 结构

```
public/
  index.html           # 全部内容：HTML + CSS + JS + 数据，单文件
  assets/covers/*.webp # 33 张竖版海报，480×640
  assets/bgs/*.webp    # 3 张横版大图（只有这 3 部有）
wrangler.toml          # Cloudflare Workers + 静态资源
*.py                   # 一次性数据采集脚本（解析置顶评论、解析短链、拉 PGC 元数据）
movies_detail.json     # 归一化后的 33 部影片元数据
links.json             # b23.tv 短链 → bangumi 播放页的映射
```

`public/` 里没有任何依赖、构建步骤、外部请求。

## 行为

- **随机不重复**：33 部洗牌成一轮，用完再重洗。
- **已看记录**：点「就看这个」标记已看，存 `localStorage`，右上角 `已看 n / 33`。
- **全部看完**：弹「这一单吃完了」，33 格金色方块，可「重新来一轮」。
- **键盘**：`空格` 换一部，`回车` 就去看。
- **触屏**：左右滑动换一部。
- **背景**：有横版图用横版图，没有就用海报模糊放大铺底。

## 部署

Cloudflare Workers 静态资源，`wrangler.toml` 里声明自定义域名。

```bash
wrangler deploy
```

改完 `public/` 重新 deploy 即可，秒级生效。

## 素材来源

B 站 PGC 接口（`api.bilibili.com/pgc/view/web/season`）。图片已本地化为 WebP，不依赖 B 站 CDN 防盗链。

B 站接口的原始返回（含其他用户的 uid、昵称、头像地址）不入库，见 `.gitignore`。
