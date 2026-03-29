"use client";

import { Player } from "@remotion/player";
import { OverlayLaunchVideo, OVERLAY_LAUNCH_VIDEO } from "@/remotion/OverlayLaunchVideo";

export default function LaunchVideoPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white px-6 py-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.28em] text-sky-300">launch video preview</div>
          <h1 className="font-serif text-5xl tracking-tight text-white">overlay web app launch video</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            Remotion preview for the launch video composition. Use this page to review pacing and copy, then render the final video with the npm script.
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <Player
            component={OverlayLaunchVideo}
            durationInFrames={OVERLAY_LAUNCH_VIDEO.durationInFrames}
            fps={OVERLAY_LAUNCH_VIDEO.fps}
            compositionHeight={OVERLAY_LAUNCH_VIDEO.height}
            compositionWidth={OVERLAY_LAUNCH_VIDEO.width}
            controls
            loop
            autoPlay={false}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            inputProps={{
              title: "One workspace to think, remember, create, and act.",
            }}
          />
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
          <div>Preview route: /launch-video</div>
          <div>Studio: npm run video:studio</div>
          <div>Render: npm run video:render:launch</div>
        </div>
      </div>
    </main>
  );
}
