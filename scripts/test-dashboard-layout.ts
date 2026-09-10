import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { mongo } from "../lib/mongodb";
import { signSession } from "../lib/auth-jwt";
import { defaultChartIds } from "../lib/ai/dashboard-layout";

async function main() {
  const owner = `layout-test-${randomUUID()}`;
  const db = await mongo();
  const id = new ObjectId();
  const second = new ObjectId();
  const token = await signSession({
    userId: owner,
    name: "Layout Test",
    email: "test@example.invalid",
    role: "admin",
  });
  const other = await signSession({
    userId: `${owner}-other`,
    name: "Other",
    email: "other@example.invalid",
    role: "trainer",
  });
  const url =
    (process.env.TEST_BASE_URL || "http://127.0.0.1:3001") +
    "/api/dashboard/layout";
  const request = (body?: unknown, auth = token) =>
    fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const get = async () => {
    const r = await request();
    assert.equal(r.status, 200);
    return r.json();
  };
  const write = async (body: unknown) => {
    const r = await request(body);
    assert.equal(r.status, 200, await r.text());
  };
  try {
    for (const chartId of [id, second])
      await db
        .collection("portal_ai_charts")
        .insertOne({
          _id: chartId,
          ownerId: owner,
          role: "admin",
          chart: {
            id: String(chartId),
            title: "Layout test fixture",
            type: "bar",
            label: "Category",
            metric: "Count",
            rows: [{ label: "Test", value: 1 }],
            source: "test fixture",
            generatedAt: new Date().toISOString(),
            note: "Synthetic test only",
          },
        });
    assert.deepEqual((await get()).items, defaultChartIds);
    await write({
      id: String(id),
      action: "pin",
      target: defaultChartIds[0],
      placement: "replace",
    });
    let board = await get();
    assert.equal(board.items[0], String(id));
    assert.equal(board.items.length, 6);
    assert.ok(!board.items.includes(defaultChartIds[0]));
    await write({
      id: String(second),
      action: "pin",
      target: String(id),
      placement: "replace",
    });
    board = await get();
    assert.equal(board.items[0], String(second));
    assert.ok(!board.items.includes(String(id)));
    await write({
      id: String(id),
      action: "pin",
      target: defaultChartIds[2],
      placement: "before",
    });
    board = await get();
    assert.equal(
      board.items.indexOf(String(id)) + 1,
      board.items.indexOf(defaultChartIds[2]),
    );
    await write({
      id: defaultChartIds[5],
      action: "move",
      target: String(second),
      placement: "before",
    });
    assert.equal((await get()).items[0], defaultChartIds[5]);
    await write({ id: defaultChartIds[5], action: "remove" });
    await write({ id: String(id), action: "remove" });
    board = await get();
    assert.ok(!board.items.includes(defaultChartIds[5]));
    assert.ok(!board.items.includes(String(id)));
    assert.equal(
      (await request({ id: String(id), action: "pin", revision: 0 })).status,
      409,
    );
    assert.equal(
      (await request({ id: String(id), action: "pin" }, other)).status,
      404,
    );
    assert.equal(
      (await request({ id: defaultChartIds[0], action: "pin" }, other)).status,
      403,
    );
    assert.equal((await request({ id: "invalid", action: "pin" })).status, 422);
    assert.equal((await fetch(url)).status, 403);
    assert.deepEqual(
      (await (await request(undefined, other)).json()).items,
      [],
    );
    assert.ok(
      await db.collection("portal_ai_charts").findOne({ _id: id }),
      "Removing from dashboard preserves the conversation artifact",
    );
    console.log(
      "PASS builtin and AI replacement, insertion, reorder, deletion, reload persistence, revision conflicts, ownership and authorization.",
    );
  } finally {
    await db
      .collection("portal_chart_boards")
      .deleteMany({ _id: { $in: [owner, `${owner}-other`] } } as never);
    await db.collection("portal_ai_charts").deleteMany({ ownerId: owner });
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
