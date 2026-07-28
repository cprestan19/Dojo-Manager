import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Reusa las clases badge-* ya definidas en globals.css (@layer components) —
// esas clases ya son theme-aware (themes.css las sobreescribe en white-special).
const badgeVariants = cva("badge", {
  variants: {
    variant: {
      success: "badge-green",
      danger:  "badge-red",
      warning: "badge-yellow",
      info:    "badge-blue",
      gold:    "badge-gold",
      outline: "border border-dojo-border text-dojo-muted bg-transparent",
    },
  },
  defaultVariants: { variant: "info" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
