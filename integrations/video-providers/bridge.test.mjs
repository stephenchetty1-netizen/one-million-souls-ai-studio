import test from "node:test";
import assert from "node:assert/strict";
import { connectionStatus, submitHiggsfieldVideo, submitComfyWorkflow } from "./bridge.mjs";
test("unconfigured providers are not reported live", () => {
  assert.equal(connectionStatus({}).liveV59Integration, false);
  assert.equal(connectionStatus({}).ltxWorkflow, false);
});
test("no unapproved billable Higgsfield call", async () => {
  let calls = 0;
  await assert.rejects(submitHiggsfieldVideo("hello", {
    env: { HF_API_KEY_ID: "id", HF_API_KEY_SECRET: "secret" },
    fetchImpl: async () => { calls++; return { ok: true }; },
  }), /disabled/);
  assert.equal(calls, 0);
});
test("ZERO_CREDIT_ONLY forbids paid API use even if approved", async () => {
  await assert.rejects(submitHiggsfieldVideo("hello", {
    env: { HF_API_KEY_ID: "id", HF_API_KEY_SECRET: "secret", ZERO_CREDIT_ONLY: "true" },
    paidGenerationApproved: true,
  }), /disabled/);
});
test("ComfyUI validates workflow and HTTPS endpoint before queueing", async () => {
  await assert.rejects(submitComfyWorkflow(null, { env: { COMFYUI_URL: "https://example.org" } }), /API-format/);
  await assert.rejects(submitComfyWorkflow({ "1": {} }, { env: { COMFYUI_URL: "http://example.org" } }), /HTTPS/);
  const got = await submitComfyWorkflow({ "1": { class_type: "SaveImage", inputs: {} } }, {
    env: { COMFYUI_URL: "https://gpu.example.com/" },
    fetchImpl: async (url, request) => {
      assert.equal(url, "https://gpu.example.com/prompt");
      assert.equal(request.method, "POST");
      return { ok: true, json: async () => ({ prompt_id: "job1" }) };
    },
  });
  assert.equal(got.prompt_id, "job1");
});
