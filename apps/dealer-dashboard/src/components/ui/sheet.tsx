"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
}

export function Sheet({ open, onOpenChange, children, side = "right" }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  if (!open) return null;

  const sideClasses = {
    left: "left-0 top-0 h-full",
    right: "right-0 top-0 h-full",
    top: "top-0 left-0 w-full",
    bottom: "bottom-0 left-0 w-full",
  };

  const transformClasses = {
    left: open ? "translate-x-0" : "-translate-x-full",
    right: open ? "translate-x-0" : "translate-x-full",
    top: open ? "translate-y-0" : "-translate-y-full",
    bottom: open ? "translate-y-0" : "translate-y-full",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        className={cn(
          "fixed z-50 w-96 max-w-full bg-background shadow-lg transition-transform duration-200",
          sideClasses[side],
          transformClasses[side]
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  onClose?: () => void;
}

export function SheetContent({ children, onClose, className, ...props }: SheetContentProps) {
  return (
    <div className={cn("flex h-full flex-col", className)} {...props}>
      {onClose && (
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <h2 className="text-lg font-semibold text-foreground">Filters</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

