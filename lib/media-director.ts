export type MediaScene = {
  scene: number;
  durationSeconds: number;
  visual: string;
  onScreenText: string;
  narration: string;
  transition: string;
};

export type MediaDirection = {
  openingFrame: string;
  visualStyle: string;
  pacing: "fast" | "moderate" | "reflective";
  audioDirection: string;
  scenes: MediaScene[];
  coverConcept: string;
  platformNotes: { tiktok: string; youtube: string };
  guardrails: string[];
};

const clean = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function createMediaDirection(input: {
  title: string;
  topic: string;
  hook: string;
  scripture?: string;
  format?: string;
}): MediaDirection {
  const topic = clean(input.topic || input.title, 120);
  const hook = clean(input.hook || input.title, 140);
  const scripture = clean(input.scripture || "Scripture reference selected during Bible research", 120);

  return {
    openingFrame: `Immediate text-led opening: “${hook}” with a clean, high-contrast Christian visual.`,
    visualStyle: "Cinematic, hopeful, reverent, modern Christian short-form; uncluttered typography and purposeful movement.",
    pacing: "moderate",
    audioDirection: "Use an uplifting, non-distracting instrumental bed or platform-cleared audio. Voice/narration must remain clear.",
    scenes: [
      { scene: 1, durationSeconds: 3, visual: "Strong opening visual that immediately establishes the emotional problem or question.", onScreenText: hook, narration: hook, transition: "Hard cut" },
      { scene: 2, durationSeconds: 7, visual: `Visual metaphor or human-centered scene connected to ${topic}.`, onScreenText: "You are not alone.", narration: `Connect the viewer's real-life experience to ${topic}.`, transition: "Gentle push" },
      { scene: 3, durationSeconds: 8, visual: "Open Bible / scripture-inspired visual with readable reference treatment.", onScreenText: scripture, narration: "Present the verified Scripture faithfully and in context.", transition: "Slow dissolve" },
      { scene: 4, durationSeconds: 7, visual: "Hopeful Jesus-centered imagery with light and forward motion.", onScreenText: "Look to Jesus.", narration: "Point the message toward Jesus, hope and faithful response.", transition: "Light sweep" },
      { scene: 5, durationSeconds: 5, visual: "Simple closing frame with calm movement and clear call to action.", onScreenText: "Follow for more Christ-centered encouragement.", narration: "Invite the viewer to respond, reflect, pray or follow for more.", transition: "Fade out" }
    ],
    coverConcept: `Bold cover using the central promise/question from “${topic}”, one focal Christian visual, minimal text, strong readability on mobile.`,
    platformNotes: {
      tiktok: "Prioritize the first 1–2 seconds, readable captions and immediate emotional clarity.",
      youtube: "Prioritize clear opening context, readable text and a satisfying conclusion that matches the promise of the opening."
    },
    guardrails: [
      "Do not fabricate Scripture, quotations or biblical claims.",
      "Do not use copyrighted media unless properly licensed or platform-cleared.",
      "Do not use manipulative promises about guaranteed blessings, healing, virality or salvation outcomes.",
      "Keep Jesus and verified Scripture central rather than optimizing away the message."
    ]
  };
}
