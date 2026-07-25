<script lang="ts">
  import { cva } from "class-variance-authority";
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground hover:bg-primary/80",
          outline:
            "border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost:
            "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
          destructive:
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
    type?: "button" | "submit" | "reset";
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const classes = $derived(cn(buttonVariants({ variant, size }), className));
</script>

{#if href}
  <a {href} class={classes} {...rest}>
    {@render children?.()}
  </a>
{:else}
  <button class={classes} {disabled} {type} {...rest}>
    {@render children?.()}
  </button>
{/if}
