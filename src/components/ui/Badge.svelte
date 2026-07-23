<script lang="ts">
  import { cva } from "class-variance-authority";
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  const badgeVariants = cva(
    "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground",
          secondary: "bg-secondary text-secondary-foreground",
          destructive: "bg-destructive/10 text-destructive",
          outline: "border-border text-foreground",
          ghost: "hover:bg-muted hover:text-muted-foreground",
        },
      },
      defaultVariants: { variant: "default" },
    }
  );

  let {
    variant = "default" as
      | "default"
      | "secondary"
      | "destructive"
      | "outline"
      | "ghost",
    class: className = "",
    children,
    ...rest
  }: {
    variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)} {...rest}>
  {@render children?.()}
</span>
