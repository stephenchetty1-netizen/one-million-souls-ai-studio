import { NextRequest, NextResponse } from "next/server";
import { createMediaDirection } from "@/lib/media-director";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.title || !body?.topic) {
    return NextResponse.json({ error: "title and topic are required" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mediaDirection: createMediaDirection(body)
  });
}
