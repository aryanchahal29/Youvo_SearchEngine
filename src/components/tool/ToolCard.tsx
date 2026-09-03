"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import type { ToolWithDetails } from "@/lib/supabase/types";

// ============================================================
// CONFIDENCE INDICATOR
// ============================================================

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const level =
    confidence >= 0.8
      ? "high"
      : confidence >= 0.5
        ? "medium"
        : "low";

  const config = {
    high: {
      label: "High confidence",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50 border border-emerald-200",
      icon: ShieldCheck,
      tooltip: `Based on strong evidence from multiple sources`,
    },
    medium: {
      label: "Medium confidence",
      color: "text-amber-700",
      bgColor: "bg-amber-50 border border-amber-200",
      icon: ShieldAlert,
      tooltip: `Some data points may be incomplete`,
    },
    low: {
      label: "Low confidence",
      color: "text-red-700",
      bgColor: "bg-red-50 border border-red-200",
      icon: ShieldQuestion,
      tooltip: `Limited evidence available`,
    },
  }[level];

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.tooltip}</p>
        <p className="text-muted-foreground text-xs mt-1">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// SCORE BADGE
// ============================================================

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
      : score >= 70
        ? "text-blue-700 border-blue-200 bg-blue-50"
        : score >= 50
          ? "text-amber-700 border-amber-200 bg-amber-50"
          : "text-red-700 border-red-200 bg-red-50";

  return (
    <div
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-lg tabular-nums ${color}`}
    >
      {Math.round(score)}
      <span className="text-xs font-normal opacity-60">/100</span>
    </div>
  );
}

// ============================================================
// PRICING DISPLAY
// ============================================================

function PricingDisplay({
  pricingPlans,
}: {
  pricingPlans: ToolWithDetails["pricing_plans"];
}) {
  const freePlan = pricingPlans.find((p) => p.is_free);
  const cheapestPaid = pricingPlans
    .filter((p) => !p.is_free && p.price !== null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];

  if (!freePlan && !cheapestPaid) {
    return (
      <span className="text-xs text-muted-foreground">
        Pricing info unavailable
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {freePlan && (
        <div className="flex flex-col gap-0.5">
          <Badge
            variant="secondary"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 w-fit text-xs font-semibold"
          >
            Free plan
          </Badge>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mt-1">
            {freePlan.free_credits && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {freePlan.free_credits} {freePlan.credit_period || "credits"}
              </span>
            )}
            {freePlan.watermark === false && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                No watermark
              </span>
            )}
            {freePlan.watermark === true && (
              <span className="flex items-center gap-1">
                <X className="w-3.5 h-3.5 text-red-500" />
                Watermark
              </span>
            )}
            {freePlan.commercial_use === true && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Commercial use
              </span>
            )}
            {freePlan.commercial_use === false && (
              <span className="flex items-center gap-1">
                <X className="w-3.5 h-3.5 text-red-500" />
                No commercial use
              </span>
            )}
          </div>
        </div>
      )}
      {cheapestPaid && (
        <span className="text-xs text-muted-foreground">
          Paid from{" "}
          <span className="text-foreground font-medium">
            ${cheapestPaid.price}/{cheapestPaid.billing_period === "yearly" ? "yr" : "mo"}
          </span>
        </span>
      )}
    </div>
  );
}

// ============================================================
// FRESHNESS INDICATOR
// ============================================================

function FreshnessIndicator({
  lastVerified,
}: {
  lastVerified: string | null;
}) {
  if (!lastVerified) {
    return (
      <span className="text-xs text-amber-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Not yet verified
      </span>
    );
  }

  const hoursAgo =
    (Date.now() - new Date(lastVerified).getTime()) / (1000 * 60 * 60);

  let label: string;
  let color: string;

  if (hoursAgo < 1) {
    label = "Just verified";
    color = "text-emerald-600";
  } else if (hoursAgo < 24) {
    label = `Verified ${Math.round(hoursAgo)}h ago`;
    color = "text-emerald-600";
  } else if (hoursAgo < 72) {
    label = `Verified ${Math.round(hoursAgo / 24)}d ago`;
    color = "text-gray-500";
  } else if (hoursAgo < 168) {
    label = `Verified ${Math.round(hoursAgo / 24)}d ago`;
    color = "text-amber-600";
  } else {
    label = "⚠ May be outdated";
    color = "text-red-500";
  }

  return (
    <span className={`text-xs flex items-center gap-1 ${color}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================
// TOOL CARD (Frontend Spec §24)
// ============================================================

interface ToolCardProps {
  tool: ToolWithDetails;
  rank?: number;
  isBestMatch?: boolean;
  explanation?: string | null;
  matchedConstraints?: string[];
}

export function ToolCard({
  tool,
  rank,
  isBestMatch = false,
  explanation,
  matchedConstraints = [],
}: ToolCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const score = tool.latest_score?.overall_score ?? tool.quality_score ?? 0;
  const confidence = tool.latest_score?.confidence ?? tool.confidence_score ?? 0;

  return (
    <Card
      className={`
        relative overflow-hidden transition-all duration-300
        hover:border-primary/50 hover:shadow-lg
        ${isBestMatch
          ? "border-primary/40 shadow-md bg-card/80 backdrop-blur-md ring-1 ring-primary/20"
          : "border-border/50 bg-card/50 backdrop-blur-sm"
        }
      `}
    >
      {/* Best Match Badge */}
      {isBestMatch && (
        <div className="absolute top-0 right-0 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-bl-xl shadow-sm">
          BEST MATCH
        </div>
      )}

      {/* Rank Badge */}
      {rank && !isBestMatch && (
        <div className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 text-sm font-bold text-muted-foreground ring-1 ring-border/50">
          #{rank}
        </div>
      )}

      <CardContent className="p-6">
        {/* Header: Logo + Name + Description */}
        <div className="flex items-start gap-4 mb-4">
          {/* Logo placeholder */}
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 text-xl font-bold text-muted-foreground ring-1 ring-border/50">
            {tool.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tool.logo_url}
                alt={tool.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              tool.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <Link
              href={`/tools/${tool.slug}`}
              className="text-xl font-bold hover:text-primary transition-colors line-clamp-1"
            >
              {tool.name}
            </Link>
            <p className="text-base text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {tool.short_description || tool.description}
            </p>
          </div>
        </div>

        {/* Score + Confidence */}
        <div className="flex items-center gap-3 mb-3">
          <ScoreBadge score={score} />
          <ConfidenceIndicator confidence={confidence} />
        </div>

        {/* Pricing */}
        <div className="mb-3">
          <PricingDisplay pricingPlans={tool.pricing_plans} />
        </div>

        {/* Key advantages + limitations */}
        {matchedConstraints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {matchedConstraints.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100"
              >
                <Check className="w-3 h-3" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Freshness */}
        <div className="mb-3">
          <FreshnessIndicator lastVerified={tool.last_verified_at} />
        </div>

        {/* Why #1 - Expandable (Frontend Spec §25) */}
        {explanation && (
          <div className="border-t border-border/50 pt-2 mt-2">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-full"
            >
              {showExplanation ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              Why #{rank || 1}?
            </button>
            {showExplanation && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {explanation}
              </p>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex gap-2 mt-4">
          <Link
            href={`/tools/${tool.slug}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            View Tool
          </Link>
          {tool.official_url && (
            <a
              href={tool.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-3 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={`Visit ${tool.name} website`}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { ConfidenceIndicator, ScoreBadge, PricingDisplay, FreshnessIndicator };
