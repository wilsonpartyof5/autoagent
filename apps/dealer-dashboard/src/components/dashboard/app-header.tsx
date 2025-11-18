"use client";

import { Bell, ShieldCheck, Menu, X, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { switchDealership } from "@/app/app/actions/dealership";
import type { Dealership } from "@/lib/supabase/dealerships";

type AppHeaderProps = {
  dealerships: Dealership[];
  activeDealership: Dealership | null;
  onToggleMobileSidebar?: () => void;
  isMobileNavOpen?: boolean;
};

export function AppHeader({
  dealerships,
  activeDealership,
  onToggleMobileSidebar,
  isMobileNavOpen = false,
}: AppHeaderProps) {
  const router = useRouter();

  // Normalize demo dealership naming so we don't surface "Rock Hill GMC" in the UI.
  const normalizeName = (name: string | null | undefined) =>
    name && name.toLowerCase().includes("rock hill gmc") ? "Demo Account" : name;

  const normalizedDealerships =
    dealerships?.map((dealership) => ({
      ...dealership,
      name: normalizeName(dealership.name) || "Demo Account",
    })) ?? [];

  const dealershipName = normalizeName(activeDealership?.name) || "Your Dealership";

  const handleDealershipChange = async (dealershipId: string) => {
    if (dealershipId === "__add_store__") {
      router.push("/app/settings");
      return;
    }
    
    if (dealershipId === activeDealership?.id) {
      return;
    }
    
    try {
      await switchDealership(dealershipId);
      router.refresh();
    } catch (error) {
      console.error("Failed to switch dealership:", error);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full lg:hidden"
          onClick={onToggleMobileSidebar}
        >
          {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="sr-only">Toggle navigation</span>
        </Button>
        <div className="flex items-center gap-3">
          {normalizedDealerships.length > 0 ? (
            <Select
              value={activeDealership?.id || ""}
              onValueChange={handleDealershipChange}
            >
              <SelectTrigger className="w-[200px] border-none bg-transparent shadow-none hover:bg-muted/50 focus:ring-0">
                <SelectValue>
                  <span className="text-lg font-semibold text-foreground">{dealershipName}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {normalizedDealerships.map((dealership) => (
                  <SelectItem key={dealership.id} value={dealership.id}>
                    {dealership.name}
                  </SelectItem>
                ))}
                <div className="border-t border-border/60 my-1" />
                <SelectItem value="__add_store__" className="text-primary font-medium">
                  <Plus className="h-4 w-4 inline mr-2" />
                  Add Store
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <h1 className="text-lg font-semibold text-foreground">{dealershipName}</h1>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 text-primary">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
              Secure
            </div>
            <span>•</span>
            <span>Connected to ChatGPT</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <div className="hidden items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          AI-Verified Leads
        </div>
      </div>
    </header>
  );
}
