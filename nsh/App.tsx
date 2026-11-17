import { mount, signal, computed, Storage, openUrl, keymap, platform, Text, View, Image } from "nsh";
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
import banner13 from "./assets/bgs/13.webp";
import banner32 from "./assets/bgs/32.webp";
import banner33 from "./assets/bgs/33.webp";

type Movie = {
  i: number; t: string; y: string; d: number; g: string;
  s: number; v: number; badge: string; url: string; r: string; bg: boolean;
};

const MOVIES = movies as Movie[];
const STORE = "kansha.watched.v1";
const GOLD = "#E8C07A";
const INK = "#171410";

const COVERS: Record<number, any> = {
  1: cover1,
  2: cover2,
  3: cover3,
  4: cover4,
  5: cover5,
  6: cover6,
  7: cover7,
  8: cover8,
  9: cover9,
  10: cover10,
  11: cover11,
  12: cover12,
  13: cover13,
  14: cover14,
  15: cover15,
  16: cover16,
  17: cover17,
  18: cover18,
  19: cover19,
  20: cover20,
  21: cover21,
  22: cover22,
  23: cover23,
  24: cover24,
  25: cover25,
  26: cover26,
  27: cover27,
  28: cover28,
  29: cover29,
  30: cover30,
  31: cover31,
  32: cover32,
  33: cover33,
};

const BANNERS: Record<number, any> = {
  13: banner13,
  32: banner32,
  33: banner33,
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

  // iPad 屏大，卡片放宽、字号放大，并且整体居中，不然全挤在底部一条。
  // 11 寸 iPad 是 1032pt 宽，卡片给到 860pt 才算有存在感。
  const PAD = platform.idiom === "pad";
  const W = PAD ? 860 : 560;
  const COVER_W = PAD ? 240 : 116;

  keymap.bind("space", () => next());
  keymap.bind("enter", () => go());


  return (
    <View class="flex-1 bg-[#07070A] overflow-hidden">
      <View class="absolute left-0 top-0 right-0 bottom-0">
        <Image
          src={mv().bg ? BANNERS[mv().i] : COVERS[mv().i]}
          class="absolute left-0 top-0 right-0 bottom-0"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          blurRadius={mv().bg ? 0 : 64}
        />
        <View class="absolute left-0 top-0 right-0 bottom-0 bg-[rgba(7,7,10,0.5)]" />
        <View
          class="absolute left-0 right-0 bottom-0"
          style={{
            height: "74%",
            backgroundImage: "linear-gradient(0deg,#07070A 4%,rgba(7,7,10,0.9) 38%,rgba(7,7,10,0.45) 68%,rgba(7,7,10,0) 100%)",
          }}
        />
      </View>

      <View class="flex-row items-center justify-between px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}>
        <Text class="text-[13px] text-[#E8C07A] font-semibold">看 啥</Text>
        <Text class="text-[12px] text-[#8A8A93]">已看 {watched().length} / {total}</Text>
      </View>

      {allDone() ? (
        <View class="flex-1 items-center justify-center px-6 gap-5">
          <View class="items-center gap-2">
            <Text class="text-[26px] font-semibold text-[#F2EFE8]">这一单吃完了</Text>
            <Text class="text-[13px] text-[#8A8A93]">{total} 部，全看过了</Text>
          </View>
          <View class="flex-row flex-wrap justify-center gap-[6px]" style={{ width: 350 }}>
            <Each of={MOVIES}>
              {(x) => <View style={{ width: 26, height: 26, borderRadius: 3, backgroundColor: GOLD }} />}
            </Each>
          </View>
          <View
            onPress={reset}
            role="button"
            class="px-7 py-3 rounded-xl border border-[rgba(232,192,122,0.35)] active:bg-[rgba(232,192,122,0.12)]"
          >
            <Text class="text-[14px] text-[#E8C07A]">重新来一轮</Text>
          </View>
        </View>
      ) : (
        <View class="flex-1 justify-end items-center px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)", ...(PAD ? { justifyContent: "center", paddingBottom: 40 } : {}) }}>
          <View style={{ width: "100%", maxWidth: W }}>
          <View
            testID="ticket"
            panActivation={{ activeOffsetX: 18, failOffsetY: 26 }}
            onPanEnd={onSwipeEnd}
            class="flex-row rounded-2xl bg-[rgba(14,14,18,0.86)] border border-[rgba(255,255,255,0.09)] overflow-hidden">
            <View style={{ width: COVER_W, aspectRatio: 0.75 }}>
              <Image src={COVERS[mv().i]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <View class="flex-1 py-4 pr-4 gap-[7px]" style={{ paddingLeft: PAD ? 20 : 14 }}>
              <Text class="text-[19px] font-semibold text-[#F2EFE8]" style={{ numberOfLines: 2, ...(PAD ? { fontSize: 26 } : {}) }}>{mv().t}</Text>
              <Text class="text-[11.5px] text-[#8A8A93]" style={PAD ? { fontSize: 14 } : undefined}>{mv().y} · {mv().d} 分钟 · {mv().g}</Text>
              <Text class="text-[12.5px] leading-5 text-[#C9C6BF]" style={{ numberOfLines: PAD ? 4 : 3, ...(PAD ? { fontSize: 15, lineHeight: 24 } : {}) }}>{mv().r}</Text>
              <View class="flex-row items-center gap-[6px]">
                <Text class="text-[12px] text-[#E8C07A] font-semibold" style={PAD ? { fontSize: 14 } : undefined}>{mv().s ? "B站 " + mv().s.toFixed(1) : "暂无评分"}</Text>
                {mv().badge ? (
                  <View class="px-[5px] py-[1px] rounded-[3px] border border-[rgba(232,192,122,0.4)]">
                    <Text class="text-[9px] text-[#E8C07A]" style={PAD ? { fontSize: 11 } : undefined}>{mv().badge}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View class="flex-row gap-[10px] mt-3" style={{ width: "100%", maxWidth: W }}>
            <View
              onPress={go}
              role="button"
              class="flex-1 items-center justify-center rounded-xl active:opacity-80"
              style={{ backgroundColor: GOLD, paddingTop: PAD ? 18 : 13, paddingBottom: PAD ? 18 : 13 }}
            >
              <Text class="text-[14.5px] font-semibold" style={{ color: INK, ...(PAD ? { fontSize: 17 } : {}) }}>就看这个</Text>
            </View>
            <View
              onPress={next}
              role="button"
              class="flex-1 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.16)] active:bg-[rgba(255,255,255,0.07)]"
              style={{ paddingTop: PAD ? 18 : 13, paddingBottom: PAD ? 18 : 13 }}
            >
              <Text class="text-[14.5px] text-[#E4E1DA]" style={PAD ? { fontSize: 17 } : undefined}>换一个</Text>
            </View>
          </View>

          <If when={platform.desktop}>
            <Text class="text-[10.5px] text-[#5C5C64] text-center mt-3" style={{ width: "100%", maxWidth: W }}>空格 换一部 · 回车 就去看</Text>
          </If>
          <If when={!platform.desktop}>
            <Text class="text-[10.5px] text-[#5C5C64] text-center mt-3" style={{ width: "100%", maxWidth: W }}>左右滑动换一部</Text>
          </If>
          </View>
        </View>
      )}
    </View>
  );
}

mount(App);
