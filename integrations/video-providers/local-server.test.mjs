import test from "node:test";
import assert from "node:assert/strict";
import { createLocalServer } from "./local-server.mjs";
const env = { OMS_LOCAL_TOKEN: "a".repeat(64), ZERO_CREDIT_ONLY: "true" };
async function withServer(run, overrides = {}) {
  const server = createLocalServer({ env: { ...env, ...overrides } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
}
test("startup refuses default token", () => {
  assert.throws(() => createLocalServer({ env: { OMS_LOCAL_TOKEN: "REPLACE_WITH_A_RANDOM_64_CHARACTER_HEX_TOKEN" } }), /unique/);
});
test("health is public but configuration requires token", async () => {
  await withServer(async base => {
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/api/status")).status, 401);
    const response = await fetch(base + "/api/status", { headers: { Authorization: "Bearer " + env.OMS_LOCAL_TOKEN } });
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.liveV59Integration, false);
    assert.equal(status.paidAI, "disabled in local dashboard");
  });
});
test("ComfyUI queue cannot submit without a configured endpoint", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/api/comfy/queue", {
      method: "POST", headers: {
        Authorization: "Bearer " + env.OMS_LOCAL_TOKEN, "Content-Type": "application/json",
      }, body: JSON.stringify({ workflow: { "1": { class_type: "SaveImage", inputs: {} } } }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /COMFYUI_URL/);
  });
});
