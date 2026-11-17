import { expect, open, test } from "nsh/test";

const KEY = "kansha.watched.v1";

function titleOf(texts: string[]): string {
  const i = texts.findIndex((t) => t.startsWith("已看 "));
  return texts[i + 1] || "";
}

test("starts on a movie with a ticket", async () => {
  const app = await open("./App.tsx");
  const t = app.texts();
  expect(t).toContain("看 啥");
  expect(t).toContain("已看 0 / 33");
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
