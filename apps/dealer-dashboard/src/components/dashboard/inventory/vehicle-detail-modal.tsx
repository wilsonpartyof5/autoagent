"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateVehicleLiveStatus } from "@/app/app/inventory/actions";
import type { InventoryVehicle } from "@/app/app/inventory/page";
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  MessageSquare,
  Calendar,
  DollarSign,
  Clock,
  Radio,
  Power,
} from "lucide-react";

type Props = {
  vehicle: InventoryVehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate?: (vehicleId: string, isLive: boolean) => void;
};

// Mock analytics data for testing
function generateMockAnalytics(vehicleId: string) {
  // Generate consistent mock data based on vehicle ID
  const seed = vehicleId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return {
    views: 47 + (seed % 30),
    clicks: 12 + (seed % 15),
    leads: 3 + (seed % 5),
    conversionRate: ((12 + (seed % 15)) / (47 + (seed % 30))) * 100,
    avgTimeOnPage: 2.3 + (seed % 10) / 10,
    lastLeadAt: new Date(Date.now() - (seed % 7) * 24 * 60 * 60 * 1000),
    priceViews: 28 + (seed % 20),
    daysSincePublished: 5 + (seed % 10),
    trend: seed % 3 === 0 ? "up" : seed % 3 === 1 ? "down" : "stable",
    trendPercentage: (seed % 20) - 10,
  };
}

export function VehicleDetailModal({ vehicle, open, onOpenChange, onStatusUpdate }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingLiveStatus, setPendingLiveStatus] = useState<boolean | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Reset selected image when vehicle changes (must be before early return)
  useEffect(() => {
    if (vehicle) {
      setSelectedImageIndex(0);
    }
  }, [vehicle?.id]);

  if (!vehicle) return null;

  const mockAnalytics = generateMockAnalytics(vehicle.id);
  const isLive = vehicle.is_live ?? false;

  const handleLiveToggle = (newStatus: boolean) => {
    if (newStatus && !isLive) {
      // Show confirmation when turning ON
      setPendingLiveStatus(newStatus);
      setShowConfirmDialog(true);
    } else {
      // Turn OFF immediately
      updateLiveStatus(newStatus);
    }
  };

  const confirmToggle = () => {
    if (pendingLiveStatus !== null) {
      updateLiveStatus(pendingLiveStatus);
      setShowConfirmDialog(false);
      setPendingLiveStatus(null);
    }
  };

  const updateLiveStatus = (newStatus: boolean) => {
    startTransition(async () => {
      try {
        const result = await updateVehicleLiveStatus(vehicle.id, newStatus);
        if (result.success) {
          // Use the published_at from server response if available
          const publishedAt = result.data?.published_at || (newStatus ? new Date().toISOString() : null);
          onStatusUpdate?.(vehicle.id, newStatus, publishedAt);
        } else {
          console.error("Failed to update live status:", result.error);
          alert(`Failed to update status: ${result.error || "Unknown error"}`);
        }
      } catch (error) {
        console.error("Failed to update live status:", error);
        alert(`Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    });
  };

  // Extract enriched data
  const rawData = vehicle.raw as {
    original?: unknown;
    enriched?: {
      media?: {
        photo_links?: string[];
        primary_photo_url?: string;
      };
      extra?: {
        seller_comments?: string;
        options?: Array<{
          name?: string;
          code?: string;
          description?: string;
        }>;
      };
    };
  } | null;

  const enrichedListing =
    rawData && typeof rawData === "object" && "enriched" in rawData
      ? (rawData.enriched as {
          media?: { photo_links?: string[]; primary_photo_url?: string };
        })
      : null;

  const enrichedPhotos = enrichedListing?.media?.photo_links;
  const enrichedPrimaryPhoto = enrichedListing?.media?.primary_photo_url;
  const enrichedExtra =
    rawData && typeof rawData === "object" && "enriched" in rawData
      ? (rawData.enriched as {
          extra?: {
            seller_comments?: string;
            options?: Array<{ name?: string; code?: string; description?: string }>;
          };
        })?.extra
      : null;

  const sellerComments = enrichedExtra?.seller_comments;
  const options = enrichedExtra?.options ?? [];

  const allPhotos = [
    enrichedPrimaryPhoto,
    vehicle.primary_photo_url,
    vehicle.thumbnail_url,
    ...(enrichedPhotos ?? []),
    ...(vehicle.photo_urls ?? []),
  ].filter((url): url is string => Boolean(url));

  // Remove duplicates while preserving order
  const uniquePhotos = Array.from(new Set(allPhotos));
  const primaryImage = uniquePhotos[selectedImageIndex] ?? uniquePhotos[0] ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="xl" onClose={() => onOpenChange(false)}>
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-foreground">
                    {vehicle.year ?? "—"} {vehicle.make ?? ""} {vehicle.model ?? ""}
                  </h2>
                  {vehicle.condition && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {vehicle.condition.toUpperCase()}
                    </span>
                  )}
                  {vehicle.body_type && (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {vehicle.body_type}
                    </span>
                  )}
                </div>
                {vehicle.trim && (
                  <p className="text-sm text-muted-foreground">{vehicle.trim}</p>
                )}
              </div>
            </div>

            {/* Prominent Live Status Banner */}
            <LiveStatusBanner
              isLive={isLive}
              onToggle={handleLiveToggle}
              disabled={isPending}
              publishedAt={vehicle.published_at}
            />

            {/* Analytics Section - Above the Fold */}
            {isLive && (
              <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Performance Analytics</h3>
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={`h-4 w-4 ${
                        mockAnalytics.trend === "up"
                          ? "text-green-600"
                          : mockAnalytics.trend === "down"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        mockAnalytics.trend === "up"
                          ? "text-green-600"
                          : mockAnalytics.trend === "down"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      {mockAnalytics.trendPercentage > 0 ? "+" : ""}
                      {mockAnalytics.trendPercentage}% this week
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <AnalyticsCard
                    icon={Eye}
                    label="Total Views"
                    value={mockAnalytics.views.toLocaleString()}
                    subtitle={`${mockAnalytics.priceViews} price views`}
                    trend={mockAnalytics.trendPercentage}
                  />
                  <AnalyticsCard
                    icon={MousePointerClick}
                    label="Clicks"
                    value={mockAnalytics.clicks.toLocaleString()}
                    subtitle={`${mockAnalytics.conversionRate.toFixed(1)}% CTR`}
                  />
                  <AnalyticsCard
                    icon={MessageSquare}
                    label="Leads Generated"
                    value={mockAnalytics.leads.toLocaleString()}
                    subtitle={
                      mockAnalytics.lastLeadAt
                        ? `${Math.floor((Date.now() - mockAnalytics.lastLeadAt.getTime()) / (1000 * 60 * 60))}h ago`
                        : "No recent leads"
                    }
                  />
                  <AnalyticsCard
                    icon={Clock}
                    label="Avg. Time"
                    value={`${mockAnalytics.avgTimeOnPage.toFixed(1)}m`}
                    subtitle={`${mockAnalytics.daysSincePublished} days live`}
                  />
                </div>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Image Gallery */}
              <div className="lg:col-span-1 space-y-4">
                {primaryImage ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-muted">
                    <Image
                      src={primaryImage}
                      alt={`${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""} - Image ${selectedImageIndex + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 400px"
                      priority
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground">
                    No photo available
                  </div>
                )}
                {uniquePhotos.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uniquePhotos.slice(0, 8).map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative aspect-square overflow-hidden rounded border-2 transition-all ${
                          selectedImageIndex === idx
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border/40 hover:border-border/60"
                        } bg-muted`}
                        aria-label={`View image ${idx + 1} of ${uniquePhotos.length}`}
                      >
                        <Image
                          src={photo}
                          alt={`Thumbnail ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="100px"
                        />
                        {selectedImageIndex === idx && (
                          <div className="absolute inset-0 bg-primary/10" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {uniquePhotos.length > 8 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Showing 8 of {uniquePhotos.length} photos
                  </p>
                )}
              </div>

              {/* Right Column - Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Key Specifications */}
                <DetailSection title="Key Specifications">
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="VIN" value={vehicle.vin ?? "—"} />
                    <DetailItem label="Stock Number" value={vehicle.stock_number ?? "—"} />
                    <DetailItem
                      label="Price"
                      value={vehicle.price ? `$${vehicle.price.toLocaleString()}` : "—"}
                    />
                    <DetailItem
                      label="MSRP"
                      value={vehicle.msrp ? `$${vehicle.msrp.toLocaleString()}` : "—"}
                    />
                    <DetailItem
                      label="Mileage"
                      value={vehicle.miles ? `${vehicle.miles.toLocaleString()} mi` : "—"}
                    />
                    <DetailItem
                      label="Days on Market"
                      value={
                        typeof vehicle.days_on_market === "number"
                          ? `${vehicle.days_on_market} days`
                          : "—"
                      }
                    />
                  </div>
                </DetailSection>

                {/* Detailed Specs */}
                {(vehicle.drivetrain ||
                  vehicle.fuel_type ||
                  vehicle.transmission ||
                  vehicle.interior_color ||
                  vehicle.exterior_color) && (
                  <DetailSection title="Detailed Specifications">
                    <div className="grid grid-cols-2 gap-4">
                      {vehicle.drivetrain && (
                        <DetailItem label="Drivetrain" value={vehicle.drivetrain} />
                      )}
                      {vehicle.fuel_type && (
                        <DetailItem label="Fuel Type" value={vehicle.fuel_type} />
                      )}
                      {vehicle.transmission && (
                        <DetailItem label="Transmission" value={vehicle.transmission} />
                      )}
                      {vehicle.interior_color && (
                        <DetailItem label="Interior Color" value={vehicle.interior_color} />
                      )}
                      {vehicle.exterior_color && (
                        <DetailItem label="Exterior Color" value={vehicle.exterior_color} />
                      )}
                      {vehicle.certified && (
                        <DetailItem label="Certified" value="Yes" />
                      )}
                    </div>
                  </DetailSection>
                )}

                {/* Features & Options */}
                {(vehicle.features && vehicle.features.length > 0) || options.length > 0 ? (
                  <DetailSection title="Features & Options">
                    {vehicle.features && vehicle.features.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-foreground mb-2">Features</h4>
                        <div className="flex flex-wrap gap-2">
                          {vehicle.features.map((feature, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-muted px-2 py-1 text-xs text-foreground"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {options.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Options</h4>
                        <div className="space-y-2">
                          {options.map((option, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-foreground">
                                {option.name || option.code || "Option"}
                              </span>
                              {option.description && (
                                <span className="text-muted-foreground ml-2">
                                  - {option.description}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </DetailSection>
                ) : null}

                {/* Seller Comments */}
                {sellerComments && (
                  <DetailSection title="Seller Comments">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {sellerComments}
                    </p>
                  </DetailSection>
                )}

                {/* Market Data */}
                {vehicle.market_average_price && (
                  <DetailSection title="Market Data">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Market Average</p>
                        <p className="text-lg font-semibold text-foreground">
                          ${vehicle.market_average_price.toLocaleString()}
                        </p>
                      </div>
                      {vehicle.price && (
                        <div>
                          <p className="text-xs text-muted-foreground">Your Price</p>
                          <p className="text-lg font-semibold text-foreground">
                            ${vehicle.price.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </DetailSection>
                )}

                {/* Dealer Information */}
                {(vehicle.dealer_name ||
                  vehicle.dealer_address ||
                  vehicle.dealer_city ||
                  vehicle.dealer_state ||
                  vehicle.dealer_phone ||
                  vehicle.dealer_website) && (
                  <DetailSection title="Dealer Information">
                    <div className="space-y-1 text-sm">
                      {vehicle.dealer_name && (
                        <p className="font-medium text-foreground">{vehicle.dealer_name}</p>
                      )}
                      {vehicle.dealer_address && (
                        <p className="text-muted-foreground">{vehicle.dealer_address}</p>
                      )}
                      {(vehicle.dealer_city || vehicle.dealer_state) && (
                        <p className="text-muted-foreground">
                          {[vehicle.dealer_city, vehicle.dealer_state]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {vehicle.dealer_phone && (
                        <p className="text-muted-foreground">Phone: {vehicle.dealer_phone}</p>
                      )}
                      {vehicle.dealer_website && (
                        <a
                          href={vehicle.dealer_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {vehicle.dealer_website}
                        </a>
                      )}
                    </div>
                  </DetailSection>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent size="sm" onClose={() => setShowConfirmDialog(false)}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Publish Vehicle?</h3>
              <p className="text-sm text-muted-foreground">
                This vehicle will become visible in ChatGPT search and customers will be able to
                request information. Are you sure you want to publish it?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPendingLiveStatus(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={confirmToggle} disabled={isPending}>
                  {isPending ? "Publishing..." : "Publish Vehicle"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function LiveStatusBanner({
  isLive,
  onToggle,
  disabled,
  publishedAt,
}: {
  isLive: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  publishedAt: string | null;
}) {
  return (
    <div
      className={`rounded-md border p-3 transition-colors ${
        isLive
          ? "border-green-500/30 bg-green-50 dark:bg-green-950/20"
          : "border-border bg-slate-100 dark:bg-slate-800/50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isLive
                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {isLive ? (
              <Radio className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  isLive
                    ? "text-green-600 dark:text-green-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {isLive ? "Published" : "Not Published"}
              </span>
            </div>
            <p
              className={`text-xs truncate ${
                isLive
                  ? "text-green-700/80 dark:text-green-300/80"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {isLive
                ? publishedAt
                  ? `Published ${new Date(publishedAt).toLocaleDateString()} • Visible in search`
                  : "Visible in ChatGPT search"
                : "Hidden from customers"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!isLive)}
          disabled={disabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isLive
              ? "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
              : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
          }`}
          role="switch"
          aria-checked={isLive}
          aria-label={isLive ? "Vehicle is live - click to unpublish" : "Vehicle is not published - click to publish"}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isLive ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  trend?: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

