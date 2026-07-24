<script lang="ts">
  import { onDestroy } from "svelte";
  import { Pause, Play, Timer } from "@lucide/svelte";
  import Button from "@/components/ui/Button.svelte";

  let { bpm: propBpm }: { bpm: number } = $props();

  let playing = $state(false);
  // Initialize from prop; tap tempo can override locally
  let bpm = $state(0);
  bpm = propBpm;
  let beatIndicator = $state(-1); // 0-3, -1 = off

  let audioCtx: AudioContext | null = null;
  let nextBeatTime = 0;
  let beatCount = 0;
  let scheduleId: ReturnType<typeof setInterval> | null = null;
  let visualId: ReturnType<typeof setInterval> | null = null;

  const LOOKAHEAD = 0.12;
  const SCHEDULE_MS = 25;

  function getCtx(): AudioContext {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }
    return audioCtx;
  }

  function beep(ctx: AudioContext, time: number, accent: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = accent ? 1200 : 880;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.35, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  function start() {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    beatCount = 0;
    nextBeatTime = ctx.currentTime + 0.05;

    scheduleId = setInterval(() => {
      const c = audioCtx!;
      while (nextBeatTime < c.currentTime + LOOKAHEAD) {
        const accent = beatCount % 4 === 0;
        beep(c, nextBeatTime, accent);
        beatCount++;
        nextBeatTime += 60 / bpm;
      }
    }, SCHEDULE_MS);

    visualId = setInterval(() => {
      const c = audioCtx;
      if (!c) return;
      const elapsed = c.currentTime - (nextBeatTime - (beatCount * 60) / bpm);
      beatIndicator = Math.floor((elapsed * bpm) / 60) % 4;
    }, 50);
  }

  function stop() {
    if (scheduleId) clearInterval(scheduleId);
    if (visualId) clearInterval(visualId);
    scheduleId = null;
    visualId = null;
    beatIndicator = -1;
  }

  function toggle() {
    playing = !playing;
  }

  $effect(() => {
    if (playing) {
      stop();
      start();
      return () => stop();
    } else {
      stop();
    }
  });

  // Tap tempo
  let tapTimes: number[] = [];

  function tap() {
    const now = Date.now();
    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes = tapTimes.slice(-6);
    if (tapTimes.length >= 2) {
      const intervals = tapTimes
        .slice(1)
        .map((t, i) => t - tapTimes[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = Math.round(60000 / avg);
    }
  }

  onDestroy(() => {
    stop();
    audioCtx?.close();
  });
</script>

<div class="space-y-2">
  <div class="flex flex-wrap items-center gap-3">
    <Button variant={playing ? "default" : "outline"} size="sm" onclick={toggle}>
      {#if playing}
        <Pause />
      {:else}
        <Play />
      {/if}
      Metronome
    </Button>

    <Button variant="outline" size="sm" onclick={tap}>
      <Timer />
      Tap tempo
    </Button>

    <span class="font-mono text-sm font-semibold">{bpm} BPM</span>

    <div class="flex gap-1.5" aria-label="Beat indicator">
      {#each [0, 1, 2, 3] as beat}
        <span
          class="size-2.5 rounded-full transition-colors duration-75 {playing && beatIndicator === beat
            ? beat === 0
              ? 'bg-primary'
              : 'bg-primary/60'
            : 'bg-muted'}"
        ></span>
      {/each}
    </div>
  </div>

  <p class="text-xs text-muted-foreground">
    {playing ? `Playing at ${bpm} BPM — tap "Tap tempo" to adjust` : "Click play to start the click track"}
  </p>
</div>
