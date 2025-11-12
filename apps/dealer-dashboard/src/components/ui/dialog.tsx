"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.classList.remove("overflow-hidden");
      };
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  onClose?: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function DialogContent({
  children,
  onClose,
  className,
  size = "lg",
  ...props
}: DialogContentProps) {
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-full mx-4",
  };

  return (
    <div
      className={cn(
        "relative w-full max-h-[90vh] overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg transition-all",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 h-8 w-8"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <div className="max-h-[90vh] overflow-y-auto">{children}</div>
    </div>
  );
}

