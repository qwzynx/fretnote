<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    class: className = "",
    ...rest
  }: { class?: string; [key: string]: unknown } = $props();
</script>

<!-- A shimmering placeholder block. The point is to reserve the space the
     real content will take, so nothing jumps when data arrives — every
     loading state in the app used to be a one-line "Loading…" that a whole
     card grid then shoved out of the way. -->
<div
  aria-hidden="true"
  class={cn("skeleton rounded-md bg-surface-2", className)}
  {...rest}
></div>

<style>
  .skeleton {
    position: relative;
    overflow: hidden;
  }
  .skeleton::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklch, var(--foreground) 7%, transparent),
      transparent
    );
    animation: skeleton-sweep 1.6s ease-in-out infinite;
  }
  @keyframes skeleton-sweep {
    100% {
      transform: translateX(100%);
    }
  }
  /* The base layer already flattens durations under this preference, but an
     infinite sweep needs stopping outright rather than speeding up. */
  @media (prefers-reduced-motion: reduce) {
    .skeleton::after {
      animation: none;
    }
  }
</style>
