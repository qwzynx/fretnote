<script lang="ts">
  import { cva } from "class-variance-authority";
  import type { Snippet } from "svelte";
  import { Loader2 } from "@lucide/svelte";
  import { cn } from "@/lib/utils";

  const buttonVariants = cva(
    "focus-ring relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,translate] duration-fast ease-out select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
      variants: {
        variant: {
          default:
            "bg-primary text-primary-foreground shadow-raised hover:bg-primary/85",
          outline:
            "border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost:
            "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
          destructive:
            "bg-destructive text-destructive-foreground shadow-raised hover:bg-destructive/85",
          "destructive-soft":
            "bg-destructive/10 text-destructive hover:bg-destructive/20",
          link: "text-primary underline-offset-4 hover:underline",
        },
        // Touch-first heights that shrink to the dense desktop scale at `sm`.
        size: {
          default: "h-10 gap-1.5 px-3.5 sm:h-8 sm:px-2.5",
          xs: "h-8 gap-1 rounded-md px-2.5 text-xs sm:h-6 sm:px-2 [&_svg:not([class*='size-'])]:size-3",
          sm: "h-9 gap-1.5 rounded-md px-3 text-sm sm:h-7 sm:gap-1 sm:px-2.5 sm:text-2xs [&_svg:not([class*='size-'])]:size-3.5",
          lg: "h-11 gap-2 px-4 text-base sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-sm",
          icon: "size-10 sm:size-8",
          "icon-xs": "size-8 rounded-md sm:size-6 [&_svg:not([class*='size-'])]:size-3",
          "icon-sm": "size-9 rounded-md sm:size-7",
          "icon-lg": "size-11 sm:size-9",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
  );

  let {
    variant = "default" as
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "destructive"
      | "destructive-soft"
      | "link",
    size = "default" as
      | "default"
      | "xs"
      | "sm"
      | "lg"
      | "icon"
      | "icon-xs"
      | "icon-sm"
      | "icon-lg",
    class: className = "",
    href = undefined as string | undefined,
    disabled = false,
    loading = false,
    type = "button" as "button" | "submit" | "reset",
    children,
    ...rest
  }: {
    variant?:
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "destructive"
      | "destructive-soft"
      | "link";
    size?:
      | "default"
      | "xs"
      | "sm"
      | "lg"
      | "icon"
      | "icon-xs"
      | "icon-sm"
      | "icon-lg";
    class?: string;
    href?: string;
    disabled?: boolean;
    /** Swaps in a spinner and blocks interaction. Six call sites used to fake
     *  this by rewriting their own label to "Saving…" / "Importing…". */
    loading?: boolean;
    type?: "button" | "submit" | "reset";
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const classes = $derived(cn(buttonVariants({ variant, size }), className));
  const isDisabled = $derived(disabled || loading);
</script>

{#snippet content()}
  {#if loading}
    <!-- The label keeps its place so the button doesn't resize mid-action. -->
    <span class="absolute inset-0 flex items-center justify-center">
      <Loader2 class="animate-spin" />
    </span>
    <span class="invisible contents">{@render children?.()}</span>
  {:else}
    {@render children?.()}
  {/if}
{/snippet}

{#if href}
  <!-- An anchor can't be `disabled`, so say so the accessible way and drop
       the target rather than leaving a live link that looks inert. -->
  <a
    href={isDisabled ? undefined : href}
    aria-disabled={isDisabled || undefined}
    class={classes}
    {...rest}
  >
    {@render content()}
  </a>
{:else}
  <button class={classes} disabled={isDisabled} {type} {...rest}>
    {@render content()}
  </button>
{/if}
