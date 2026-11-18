import { mount, signal, computed, Storage, openUrl, keymap, platform, windowSize, Text, View, Image } from "nsh";
import movies from "./movies.json";
import cover1 from "./assets/covers/1.webp";
import cover2 from "./assets/covers/2.webp";
import cover3 from "./assets/covers/3.webp";
import cover4 from "./assets/covers/4.webp";
import cover5 from "./assets/covers/5.webp";
import cover6 from "./assets/covers/6.webp";
import cover7 from "./assets/covers/7.webp";
import cover8 from "./assets/covers/8.webp";
import cover9 from "./assets/covers/9.webp";
import cover10 from "./assets/covers/10.webp";
import cover11 from "./assets/covers/11.webp";
import cover12 from "./assets/covers/12.webp";
import cover13 from "./assets/covers/13.webp";
import cover14 from "./assets/covers/14.webp";
import cover15 from "./assets/covers/15.webp";
import cover16 from "./assets/covers/16.webp";
import cover17 from "./assets/covers/17.webp";
import cover18 from "./assets/covers/18.webp";
import cover19 from "./assets/covers/19.webp";
import cover20 from "./assets/covers/20.webp";
import cover21 from "./assets/covers/21.webp";
import cover22 from "./assets/covers/22.webp";
import cover23 from "./assets/covers/23.webp";
import cover24 from "./assets/covers/24.webp";
import cover25 from "./assets/covers/25.webp";
import cover26 from "./assets/covers/26.webp";
import cover27 from "./assets/covers/27.webp";
import cover28 from "./assets/covers/28.webp";
import cover29 from "./assets/covers/29.webp";
import cover30 from "./assets/covers/30.webp";
import cover31 from "./assets/covers/31.webp";
import cover32 from "./assets/covers/32.webp";
import cover33 from "./assets/covers/33.webp";
import still1 from "./assets/stills/1.webp";
import still2 from "./assets/stills/2.webp";
import still3 from "./assets/stills/3.webp";
import still4 from "./assets/stills/4.webp";
import still5 from "./assets/stills/5.webp";
import still6 from "./assets/stills/6.webp";
import still7 from "./assets/stills/7.webp";
import still8 from "./assets/stills/8.webp";
import still9 from "./assets/stills/9.webp";
import still10 from "./assets/stills/10.webp";
import still11 from "./assets/stills/11.webp";
import still12 from "./assets/stills/12.webp";
import still13 from "./assets/stills/13.webp";
import still14 from "./assets/stills/14.webp";
import still15 from "./assets/stills/15.webp";
import still16 from "./assets/stills/16.webp";
import still17 from "./assets/stills/17.webp";
import still18 from "./assets/stills/18.webp";
import still19 from "./assets/stills/19.webp";
import still20 from "./assets/stills/20.webp";
import still21 from "./assets/stills/21.webp";
import still22 from "./assets/stills/22.webp";
import still23 from "./assets/stills/23.webp";
import still24 from "./assets/stills/24.webp";
import still25 from "./assets/stills/25.webp";
import still26 from "./assets/stills/26.webp";
import still27 from "./assets/stills/27.webp";
import still28 from "./assets/stills/28.webp";
import still29 from "./assets/stills/29.webp";
import still30 from "./assets/stills/30.webp";
import still31 from "./assets/stills/31.webp";
import still32 from "./assets/stills/32.webp";
import still33 from "./assets/stills/33.webp";

type Movie = {
  i: number; t: string; y: string; d: number; g: string;
  s: number; v: number; badge: string; url: string; r: string;
};

const MOVIES = movies as Movie[];
const STORE = "kansha.watched.v1";

const GOLD = "#E8C07A";
const INK = "#17140D";
const TITLE_C = "#F5F5F7";
const META_C = "#A8AAB6";
const DIM_C = "#8A8C9A";
const REVIEW_C = "#B4B6C2";
const EYEBROW_C = "#8A7A5E";
const HAIRLINE = "#33353F";

const COVERS: Record<number, any> = {
  1: cover1, 2: cover2, 3: cover3, 4: cover4, 5: cover5, 6: cover6,
  7: cover7, 8: cover8, 9: cover9, 10: cover10, 11: cover11, 12: cover12,
  13: cover13, 14: cover14, 15: cover15, 16: cover16, 17: cover17, 18: cover18,
  19: cover19, 20: cover20, 21: cover21, 22: cover22, 23: cover23, 24: cover24,
  25: cover25, 26: cover26, 27: cover27, 28: cover28, 29: cover29, 30: cover30,
  31: cover31, 32: cover32, 33: cover33,
};

// 每部片一张 16:10 的横向剧照，背景和海报因此是同一部片子
const STILLS: Record<number, any> = {
  1: still1, 2: still2, 3: still3, 4: still4, 5: still5, 6: still6,
  7: still7, 8: still8, 9: still9, 10: still10, 11: still11, 12: still12,
  13: still13, 14: still14, 15: still15, 16: still16, 17: still17, 18: still18,
  19: still19, 20: still20, 21: still21, 22: still22, 23: still23, 24: still24,
  25: still25, 26: still26, 27: still27, 28: still28, 29: still29, 30: still30,
  31: still31, 32: still32, 33: still33,
};

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = r[i]; r[i] = r[j]; r[j] = t;
  }
  return r;
}

const ALL = MOVIES.map((m) => m.i);

function App() {
  const order = signal<number[]>(shuffle(ALL));
  const pos = signal(0);
  const watched = signal<number[]>([]);

  const mv = computed((): Movie => {
    const list = order();
    const idx = list[pos() % list.length];
    return MOVIES.find((m) => m.i === idx) || MOVIES[0];
  });

  const total = MOVIES.length;
  const allDone = (): boolean => watched().length >= total;

  const bump = (arr: number[]) => {
    watched.set(arr);
    Storage.setItem(STORE, JSON.stringify(arr)).catch(() => {});
  };

  (async () => {
    try {
      const raw = await Storage.getItem(STORE);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) watched.set(arr.filter((n: any) => typeof n === "number"));
      }
    } catch {}
  })();

  const next = () => {
    if (allDone()) return;
    const list = order();
    const p = pos() + 1;
    if (p >= list.length) {
      order.set(shuffle(ALL));
      pos.set(0);
    } else {
      pos.set(p);
    }
  };

  const go = () => {
    const m = mv();
    if (!watched().includes(m.i)) bump([...watched(), m.i]);
    openUrl(m.url).catch(() => {});
    next();
  };

  const reset = () => {
    bump([]);
    order.set(shuffle(ALL));
    pos.set(0);
  };

  const onSwipeEnd = (e: { translation: { x: number; y: number } }) => {
    if (e.translation.x < -52 && Math.abs(e.translation.x) > Math.abs(e.translation.y)) next();
  };

  // 平板/桌面/横屏用宽卡片；手机竖屏按 Figma 的手机稿做竖版。
  // 两条判据：短边够大（iPad 竖屏 1024），或者明显比高还宽（手机横屏 914×411）。
  const PAGE = 24;
  const win = windowSize();
  const H = win.height;
  const PAD = platform.idiom === "pad";
  const WIDE = platform.desktop || PAD
    || Math.min(win.width, win.height) >= 700
    || win.width > win.height * 1.15;
  const SHORT = !WIDE && H < 700;

  // 手机竖屏：海报宽度按设计稿占内容宽的 80.7%，高度不够时优先缩海报。
  const reserved = (SHORT ? 86 : 96) + (SHORT ? 140 : 164) + (SHORT ? 44 : 52) + (SHORT ? 24 : 38) + (SHORT ? 20 : 30);
  const byHeight = Math.max(0, H - reserved) * 0.75;
  const byWidth = (win.width - PAGE * 2) * 0.807;
  const POSTER_W = Math.round(Math.min(byWidth, Math.max(132, Math.min(276, byHeight))));

  // 宽卡片：海报高度带上按钮和小字，别把卡片顶出屏幕。
  const coverW = Math.round(Math.min(240, Math.max(96, (H - 170) * 0.75)));
  const cardW = WIDE ? 860 : 560;

  keymap.bind("space", () => next());
  keymap.bind("enter", () => go());

  return (
    <View class="flex-1 bg-[#0A0A0C] overflow-hidden">
      <View class="absolute left-0 top-0 right-0 bottom-0">
        <Image
          src={STILLS[mv().i]}
          class="absolute left-0 top-0 right-0 bottom-0"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <View class="absolute left-0 top-0 right-0 bottom-0" style={{ backgroundColor: "rgba(10,10,12,0.62)" }} />
        <View
          class="absolute left-0 right-0 bottom-0"
          style={{
            height: "49%",
            backgroundImage: "linear-gradient(0deg,#07070A 0%,rgba(7,7,10,0) 100%)",
          }}
        />
        <View
          class="absolute left-0 right-0 bottom-0"
          style={{
            height: "38%",
            backgroundImage: "linear-gradient(0deg,#050507 0%,rgba(5,5,7,0.55) 45%,rgba(5,5,7,0) 100%)",
          }}
        />
        <View
          class="absolute left-0 top-0 right-0"
          style={{
            height: 180,
            backgroundImage: "linear-gradient(180deg,#050507 0%,rgba(5,5,7,0) 100%)",
          }}
        />
      </View>

      <View
        class="flex-row items-start justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 26px)", paddingLeft: PAGE, paddingRight: PAGE }}
      >
        <Text class="text-[24px] font-bold" style={{ color: TITLE_C, letterSpacing: 1 }}>看啥</Text>
        <View class="items-end" style={{ gap: 6 }}>
          <Text class="text-[11px]" style={{ color: DIM_C }}>已看 {watched().length} / {total}</Text>
          <View style={{ width: 80, height: 2, borderRadius: 999, backgroundColor: "#2A2C36", overflow: "hidden" }}>
            <View style={{ width: (watched().length / total) * 80, height: 2, borderRadius: 999, backgroundColor: GOLD }} />
          </View>
        </View>
      </View>

      {allDone() ? (
        <View class="flex-1 items-center justify-center px-6 gap-5">
          <View class="items-center gap-2">
            <Text class="text-[26px] font-semibold" style={{ color: TITLE_C }}>这一单吃完了</Text>
            <Text class="text-[13px]" style={{ color: DIM_C }}>{total} 部，全看过了</Text>
          </View>
          <View class="flex-row flex-wrap justify-center gap-[6px]" style={{ width: 350 }}>
            <Each of={MOVIES}>
              {() => <View style={{ width: 26, height: 26, borderRadius: 3, backgroundColor: GOLD }} />}
            </Each>
          </View>
          <View
            onPress={reset}
            role="button"
            class="items-center justify-center active:opacity-80"
            style={{ paddingHorizontal: 28, height: 48, borderRadius: 999, borderWidth: 1, borderColor: "rgba(232,192,122,0.45)" }}
          >
            <Text class="text-[14px]" style={{ color: GOLD }}>重新来一轮</Text>
          </View>
        </View>
      ) : WIDE ? (
        /* 平板：宽卡片，整块居中 */
        <View class="flex-1 items-center justify-center px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
          <View style={{ width: "100%", maxWidth: cardW }}>
            <View
              testID="ticket"
              panActivation={{ activeOffsetX: 18, failOffsetY: 26 }}
              onPanEnd={onSwipeEnd}
              class="flex-row rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "rgba(14,14,18,0.86)", borderColor: "rgba(255,255,255,0.09)" }}
            >
              <View style={{ width: coverW, aspectRatio: 0.75 }}>
                <Image src={COVERS[mv().i]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
              <View class="flex-1 py-4 pr-4" style={{ paddingLeft: 24, justifyContent: "center", gap: 12 }}>
                <Text class="font-semibold" style={{ fontSize: 26, numberOfLines: 4, color: TITLE_C }}>{mv().t}</Text>
                <Text style={{ fontSize: 14, color: DIM_C }}>{mv().y} · {mv().d} 分钟 · {mv().g}</Text>
                <Text style={{ numberOfLines: 4, fontSize: 15, lineHeight: 24, color: REVIEW_C }}>{mv().r}</Text>
                <View class="flex-row items-center" style={{ gap: 8 }}>
                  <Text class="font-semibold" style={{ fontSize: 14, color: GOLD }}>{mv().s ? "B站 " + mv().s.toFixed(1) : "暂无评分"}</Text>
                  {mv().badge ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: "rgba(232,192,122,0.4)" }}>
                      <Text style={{ fontSize: 11, color: GOLD }}>{mv().badge}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View class="flex-row" style={{ width: "100%", gap: 10, marginTop: 12 }}>
              <View
                onPress={go}
                role="button"
                class="flex-1 items-center justify-center active:opacity-80"
                style={{ backgroundColor: GOLD, height: 56, borderRadius: 999 }}
              >
                <Text class="font-semibold" style={{ fontSize: 17, color: INK }}>就看这个</Text>
              </View>
              <View
                onPress={next}
                role="button"
                class="flex-1 items-center justify-center active:opacity-80"
                style={{ height: 56, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }}
              >
                <Text style={{ fontSize: 17, color: "#E4E1DA" }}>换一个</Text>
              </View>
            </View>

            <If when={platform.desktop}>
              <Text class="text-center" style={{ fontSize: 11, color: "#5C5C64", marginTop: 12 }}>空格 换一部 · 回车 就去看</Text>
            </If>
            <If when={!platform.desktop}>
              <Text class="text-center" style={{ fontSize: 11, color: "#5C5C64", marginTop: 12 }}>左右滑动换一部</Text>
            </If>
          </View>
        </View>
      ) : (
        /* 手机：海报居中、信息在下方、胶囊按钮贴底（Figma 手机稿） */
        <View
          class="flex-1"
          testID="ticket"
          panActivation={{ activeOffsetX: 18, failOffsetY: 26 }}
          onPanEnd={onSwipeEnd}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 26px)" }}
        >
          {/* 海报贴着信息块（设计稿间距 30），屏幕高时多出来的空间留给上面的背景 */}
          <View
            class="flex-1 items-center justify-end"
            style={{ paddingHorizontal: PAGE, paddingBottom: SHORT ? 20 : 30 }}
          >
            <View style={{ width: POSTER_W, aspectRatio: 0.75, borderRadius: 14, overflow: "hidden", backgroundColor: "#0E0F15" }}>
              <Image src={COVERS[mv().i]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          </View>

          <View style={{ paddingHorizontal: PAGE, gap: SHORT ? 8 : 12 }}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: EYEBROW_C }}>今晚看这部</Text>
            <Text class="font-bold" style={{ fontSize: SHORT ? 28 : 34, lineHeight: SHORT ? 34 : 40, numberOfLines: 2, color: TITLE_C }}>
              {mv().t}
            </Text>
            <View class="flex-row items-center" style={{ gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 12, color: META_C }}>{mv().y}</Text>
              <Text style={{ fontSize: 12, color: "#4A4C58" }}>·</Text>
              <Text style={{ fontSize: 12, color: META_C }}>{mv().d} 分钟</Text>
              {mv().g ? <Text style={{ fontSize: 12, color: "#4A4C58" }}>·</Text> : null}
              {mv().g ? <Text style={{ fontSize: 12, color: META_C }}>{mv().g}</Text> : null}
              {mv().s ? <Text class="font-bold" style={{ fontSize: 12, color: GOLD }}>{mv().s.toFixed(1)} 分</Text> : null}
            </View>
            <Text style={{ fontSize: 14, lineHeight: 23, numberOfLines: SHORT ? 2 : 3, color: REVIEW_C }}>
              {mv().r}
            </Text>
          </View>

          <View class="flex-row items-center" style={{ paddingHorizontal: PAGE, gap: 12, marginTop: SHORT ? 16 : 24 }}>
            <View
              onPress={go}
              role="button"
              class="items-center justify-center active:opacity-80"
              style={{ flex: 1, height: SHORT ? 48 : 52, borderRadius: 999, backgroundColor: GOLD }}
            >
              <Text class="font-bold" style={{ fontSize: 15, color: INK }}>就看这个</Text>
            </View>
            <View
              onPress={next}
              role="button"
              class="items-center justify-center active:opacity-80"
              style={{ width: 116, height: SHORT ? 48 : 52, borderRadius: 999, borderWidth: 1, borderColor: HAIRLINE }}
            >
              <Text style={{ fontSize: 14, color: "#C9CBD5" }}>换一个</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

mount(App);
