import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { connectionStatus, submitComfyWorkflow, comfyWorkflowStatus } from "./bridge.mjs";

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>One Million Souls — Local Studio</title>
<style>
:root{font:16px system-ui,Arial,sans-serif;color:#f7fafc;background:#080f20}
*{box-sizing:border-box}body{margin:0;padding:20px;max-width:800px;margin-inline:auto}
h1{font-size:clamp(1.6rem,5vw,2.6rem);color:#d8e8ff}h2{font-size:1.15rem}
section{border:1px solid #45618a;border-radius:14px;background:#121e36;margin:15px 0;padding:18px}
label{display:block;margin:12px 0 5px}input,textarea,button{font:inherit;width:100%;padding:13px;border-radius:9px}
input,textarea{background:#070d1c;color:white;border:1px solid #8294b1}textarea{min-height:170px}
button{background:#e9bd54;color:#141b30;border:0;font-weight:700;margin:12px 0;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}small,p{line-height:1.45;color:#bdcadf}
pre{white-space:pre-wrap;word-break:break-word;background:#071020;border-radius:9px;padding:12px}
strong{color:#e9bd54}.pill{display:inline-block;border:1px solid #496caa;padding:5px 12px;border-radius:30px}
</style></head><body>
<p class="pill">LOCAL • MANUAL APPROVAL • NO PAID AI</p>
<h1>One Million Souls<br>AI Media Studio</h1>
<p>Phone-friendly controller for an independently running ComfyUI GPU server. The dashboard does not generate videos without a configured server and an explicit Queue click.</p>
<section><h2>Connect to your local dashboard</h2>
<label for="token">Local access token</label><input id="token" type="password" autocomplete="off" placeholder="Token from your .env file">
<button id="connect">Check connection</button><pre id="status">Enter your access token and tap Check connection.</pre></section>
<section><h2>ComfyUI / LTX job</h2>
<p>First install and test LTX in ComfyUI, then export its workflow in API JSON format and paste it here. Models are not automatically installed by this dashboard.</p>
<label for="workflow">ComfyUI API-format workflow JSON</label>
<textarea id="workflow" spellcheck="false" placeholder='{"1":{"class_type":"...","inputs":{}}}'></textarea>
<button id="queue">Queue workflow manually</button>
<label for="jobid">ComfyUI job ID</label><input id="jobid" placeholder="Returned prompt_id">
<button id="history">Check job status</button><pre id="output">No job submitted.</pre></section>
<section><h2>Phone access</h2><p>By default this is available at <strong>http://localhost:8787</strong> on the computer running Docker, not on your Android phone. To use a phone on a trusted Wi-Fi network, configure OMS_BIND_ADDRESS=0.0.0.0, then open <strong>http://COMPUTER-LAN-IP:8787</strong>. Do not port-forward this dashboard to the public internet. Prefer a private VPN and HTTPS outside a trusted LAN.</p></section>
<script>
const $=id=>document.getElementById(id);let token="";
async function call(path,opts={}) {
 const r=await fetch(path,{...opts,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(opts.headers||{})}});
 const body=await r.json();if(!r.ok)throw Error(body.error||"HTTP "+r.status);return body;
}
$("connect").onclick=async()=>{token=$("token").value.trim();$("status").textContent="Checking...";
 try{$("status").textContent=JSON.stringify(await call("/api/status"),null,2)}
 catch(e){$("status").textContent=e.message}};
$("queue").onclick=async()=>{ $("output").textContent="Validating...";
 try{const workflow=JSON.parse($("workflow").value);const job=await call("/api/comfy/queue",{method:"POST",body:JSON.stringify({workflow})});
 $("jobid").value=job.prompt_id;$("output").textContent=JSON.stringify(job,null,2)}
 catch(e){$("output").textContent=e.message}};
$("history").onclick=async()=>{try{$("output").textContent=JSON.stringify(await call("/api/comfy/history?id="+encodeURIComponent($("jobid").value)),null,2)}
 catch(e){$("output").textContent=e.message}};
</script></body></html>`;

const headers = {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
function send(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, { ...headers, "Content-Type": type });
  res.end(type.startsWith("application/json") ? JSON.stringify(payload) : payload);
}
function authenticated(header, token) {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(token, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
async function bodyJson(req) {
  let data = ""; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw Error("Workflow exceeds 2 MB");
    data += chunk.toString("utf8");
  }
  if (!data) throw Error("Request body is required");
  try { return JSON.parse(data); } catch { throw Error("Invalid JSON"); }
}
export function createLocalServer({ env = process.env, fetchImpl = fetch } = {}) {
  const token = env.OMS_LOCAL_TOKEN || "";
  if (token.length < 32 || token.startsWith("REPLACE_")) {
    throw Error("Set a unique OMS_LOCAL_TOKEN with at least 32 characters in .env");
  }
  return createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://local.invalid");
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return send(res, 403, { error: "Cross-origin request rejected" });
      } catch { return send(res, 403, { error: "Invalid origin" }); }
    }
    if (req.method === "GET" && path.pathname === "/health")
      return send(res, 200, { status: "ok", paidAI: "disabled" });
    if (req.method === "GET" && path.pathname === "/")
      return send(res, 200, PAGE, "text/html; charset=utf-8");
    if (!authenticated(req.headers.authorization, token))
      return send(res, 401, { error: "Incorrect access token" });
    try {
      if (req.method === "GET" && path.pathname === "/api/status") {
        let ffmpeg = false;
        try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 5000 }); ffmpeg = true; }
        catch { /* report false */ }
        return send(res, 200, {
          ...connectionStatus(env), localDashboard: true, ffmpegInstalled: ffmpeg,
          paidAI: "disabled in local dashboard",
        });
      }
      if (req.method === "POST" && path.pathname === "/api/comfy/queue") {
        const { workflow } = await bodyJson(req);
        return send(res, 200, await submitComfyWorkflow(workflow, { env, fetchImpl }));
      }
      if (req.method === "GET" && path.pathname === "/api/comfy/history") {
        return send(res, 200, await comfyWorkflowStatus(path.searchParams.get("id"), { env, fetchImpl }));
      }
      return send(res, 404, { error: "Not found" });
    } catch (error) {
      return send(res, 400, { error: error.message || "Request failed" });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createLocalServer();
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => console.log("OMS local dashboard listening on " + host + ":" + port));
}
