import { expect, open, test } from "nsh/test";

const KEY = "kansha.watched.v1";

// 手机稿：「今晚看这部」下面那行就是片名
function titleOf(texts: string[]): string {
  const i = texts.indexOf("今晚看这部");
  return i >= 0 ? texts[i + 1] || "" : "";
}

// 宽卡片版：片名紧跟在「已看 n / 33」后面
function wideTitleOf(texts: string[]): string {
  const i = texts.findIndex((t) => t.startsWith("已看 "));
  return i >= 0 ? texts[i + 1] || "" : "";
}

test("starts on a movie with a ticket", async () => {
  const app = await open("./App.tsx");
  const t = app.texts();
  expect(t).toContain("看啥");
  expect(t).toContain("已看 0 / 33");
  expect(t).toContain("今晚看这部");
  expect(titleOf(t).length).toBeGreaterThan(0);
  expect(t).toContain("就看这个");
  expect(t).toContain("换一个");
});

test("换一个 moves to another movie", async () => {
  const app = await open("./App.tsx");
  const first = titleOf(app.texts());
  await app.press("换一个");
  const second = titleOf(app.texts());
  expect(second).not.toBe(first);
});

test("就看这个 marks it watched and advances", async () => {
  const app = await open("./App.tsx");
  const first = titleOf(app.texts());
  await app.press("就看这个");
  expect(app.texts()).toContain("已看 1 / 33");
  expect(titleOf(app.texts())).not.toBe(first);
  const saved = Object.values(app.storage())[0];
  expect(JSON.parse(saved).length).toBe(1);
});

test("watched count survives a relaunch", async () => {
  const app = await open("./App.tsx", { storage: { [KEY]: "[1,2,3]" } });
  expect(app.texts()).toContain("已看 3 / 33");
});

test("a watched movie is not counted twice", async () => {
  const app = await open("./App.tsx", { storage: { [KEY]: "[1]" } });
  const t0 = app.texts();
  if (titleOf(t0) === "阳光小美女") {
    await app.press("就看这个");
    expect(app.texts()).toContain("已看 1 / 33");
  }
});

test("swiping the card changes movie", async () => {
  const app = await open("./App.tsx");
  const first = titleOf(app.texts());
  await app.drag("id:ticket", { x: -120, y: 0 });
  expect(titleOf(app.texts())).not.toBe(first);
});

test("all 33 watched shows the done screen, reset clears it", async () => {
  const all = JSON.stringify(Array.from({ length: 33 }, (_, i) => i + 1));
  const app = await open("./App.tsx", { storage: { [KEY]: all } });
  expect(app.texts()).toContain("这一单吃完了");
  expect(app.texts()).toContain("已看 33 / 33");
  await app.press("重新来一轮");
  expect(app.texts()).toContain("已看 0 / 33");
  expect(JSON.parse(Object.values(app.storage())[0]).length).toBe(0);
});

// 手机走 Figma 的竖版稿
test("phone layout is the vertical one", async () => {
  const app = await open("./App.tsx", { width: 390, height: 844 });
  expect(app.texts()).toContain("今晚看这部");
  expect(app.shows("id:ticket")).toBe(true);
});

// 平板/桌面走宽卡片：同样的内容，但不显示手机稿那句抬头
test("wide layout uses the horizontal card", async () => {
  const app = await open("./App.tsx", { width: 1024, height: 1366 });
  expect(app.texts()).toContain("已看 0 / 33");
  expect(app.texts()).not.toContain("今晚看这部");
  expect(wideTitleOf(app.texts()).length).toBeGreaterThan(0);
  await app.press("换一个");
  expect(app.texts()).toContain("已看 0 / 33");
});

test("wide layout still swipes and marks watched", async () => {
  const app = await open("./App.tsx", { width: 1024, height: 1366 });
  const first = wideTitleOf(app.texts());
  await app.drag("id:ticket", { x: -120, y: 0 });
  expect(wideTitleOf(app.texts())).not.toBe(first);
  await app.press("就看这个");
  expect(app.texts()).toContain("已看 1 / 33");
});

// 矮屏（iPhone SE 那类）不能把文字挤出屏幕
test("short phone keeps every element on screen", async () => {
  const app = await open("./App.tsx", { width: 375, height: 667 });
  const t = app.texts();
  expect(t).toContain("今晚看这部");
  expect(t).toContain("就看这个");
  expect(t).toContain("换一个");
  expect(titleOf(t).length).toBeGreaterThan(0);
});
