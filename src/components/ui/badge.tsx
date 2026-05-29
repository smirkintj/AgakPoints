import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-violet-600/30 text-violet-300",
        success: "bg-emerald-600/30 text-emerald-300",
        warning: "bg-yellow-600/30 text-yellow-300",
        danger: "bg-red-600/30 text-red-300",
        ghost: "bg-white/10 text-white/70",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
