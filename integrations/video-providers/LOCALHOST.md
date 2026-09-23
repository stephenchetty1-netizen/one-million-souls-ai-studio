# OMS mobile-friendly localhost deployment

This is an **optional separate local dashboard** for the One Million Souls AI Studio. It does not modify or redeploy the existing Railway V59 or renderer. It does not include an LTX model or create a ComfyUI GPU server. It does not schedule social posts. Higgsfield's ChatGPT connection is not transferred to your locally running application.

## Local computer / GPU machine: Docker (recommended)

Prerequisites: a desktop or GPU server with Docker Engine/Compose installed. To actually generate LTX-2.5 video locally, LTX recommends a CUDA GPU with at least 32 GB VRAM, 100 GB of available storage and Python 3.12+. See https://docs.ltx.io/open-source-model/integration-tools/comfy-ui . A phone can control this installation but cannot perform the full LTX workload itself.

```bash
git clone https://github.com/stephenchetty1-netizen/one-million-souls-ai-studio.git
cd one-million-souls-ai-studio/integrations/video-providers
cp .env.example .env
openssl rand -hex 32
```

Copy the generated random token into `.env` as `OMS_LOCAL_TOKEN`, replacing the placeholder. Keep the file private. The service refuses to boot with the placeholder or a short token.

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
```

Open **http://localhost:8787** in the computer browser and enter your `OMS_LOCAL_TOKEN`. The startup health endpoint verifies only the dashboard, not working AI models.

To stop: `docker compose down`. To inspect: `docker compose logs --tail=100 dashboard`.

## On your Android phone, same trusted Wi-Fi

Edit `.env` on the computer: `OMS_BIND_ADDRESS=0.0.0.0`; run `docker compose up -d` again. Find the **computer's LAN IPv4 address** using `hostname -I` (Linux) or `ipconfig` (Windows). Visit `http://COMPUTER-LAN-IP:8787` from the phone on the same network. Allow port 8787 through the *local* computer firewall only if needed. Do **not** set router port forwarding, share the token or expose the unencrypted LAN endpoint to an untrusted network. For remote access, use an authenticated private VPN with suitable HTTPS. Mobile data and other Wi-Fi networks cannot generally reach a LAN-only localhost without such a private network.

## Activate ComfyUI + LTX (separate GPU installation)

Install ComfyUI on your CUDA-capable machine following its official installation instructions: https://github.com/Comfy-Org/ComfyUI . In ComfyUI's Templates, search **LTX-2.5** and choose Text to Video or Image to Video; complete the required model downloads and manual test first. LTX docs: https://docs.ltx.io/open-source-model/integration-tools/comfy-ui .

After confirming ComfyUI responds from the Docker host, for ComfyUI running on the same physical computer *outside* Docker, set `COMFYUI_URL=http://host.docker.internal:8188` if the actual ComfyUI server is reachable from Docker there. On Linux, the provided compose file adds a host-gateway mapping. ComfyUI may need to listen on an interface reachable by Docker; secure its access and never publish its raw API to the internet. For an *off-machine* ComfyUI service, use an authenticated HTTPS endpoint and, if its host supports bearer auth, set `COMFYUI_API_TOKEN`. Other providers may need adapter changes for their auth scheme.

Run `docker compose up -d` after editing `.env`, refresh the dashboard and Check connection. This indicates whether an endpoint was *configured*; it does not prove the GPU or model is healthy. Paste the **actual exported ComfyUI API-format workflow JSON** in the dashboard and press Queue workflow. It will return a job ID for progress inspection.

## Higgsfield / cost safeguards

The local dashboard has **no button or route for paid Higgsfield jobs**. The optional `bridge.mjs` supports Higgsfield programmatically, but uses separately created server-side Higgsfield API credentials and explicit per-request paid approval; setting `ZERO_CREDIT_ONLY=true` blocks those calls. Your existing Higgsfield ChatGPT sign-in and website credits do not provide free API usage. Never paste credentials into the browser workflow JSON or commit `.env`.

## Tests and limits

```bash
node --test bridge.test.mjs local-server.test.mjs
```

The localhost dashboard and bridge were tested in an isolated sandbox; **no program can remotely install itself on your personal computer or phone from this GitHub commit**. Real GPU rendering, local Docker build, your actual device's connectivity, and end-to-end production are not certified by these unit tests.
