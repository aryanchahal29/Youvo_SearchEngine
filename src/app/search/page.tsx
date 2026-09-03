"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { ToolCard } from "@/components/tool/ToolCard";
import { SearchResult } from "@/lib/supabase/types";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LiveDiscoveryProgress } from "@/components/search/LiveDiscoveryProgress";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setIsLoading(false);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          throw new Error("Failed to fetch search results");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [q]);

  if (!q) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-extrabold mb-6">What are you looking for?</h2>
        <div className="w-full max-w-3xl">
          <SearchBar variant="compact" autoFocus />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header / Search Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4 max-w-6xl">
          <Link
            href="/"
            className="hidden md:flex items-center text-sm font-semibold hover:text-primary transition-colors"
          >
            YouVo
          </Link>
          <Link
            href="/"
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 max-w-2xl">
            <SearchBar initialQuery={q} variant="compact" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-6" />
            <h3 className="text-2xl font-bold text-foreground mb-3">Analyzing requirements...</h3>
            <p className="text-base text-muted-foreground max-w-lg font-medium leading-relaxed">
              We're evaluating tools based on your specific needs, checking pricing, and verifying capabilities.
            </p>
          </div>
        )}

        {/* Live Discovery Progress */}
        {!isLoading && data?.cache_state === 'DISCOVERY_IN_PROGRESS' && data?.discovery_job_id && (
          <LiveDiscoveryProgress jobId={data.discovery_job_id} />
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-red-400/10 text-red-400 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && !isLoading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* Left Sidebar (Filters/Context) */}
            <div className="hidden lg:block lg:col-span-3 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4 text-foreground/80 uppercase tracking-wider">
                  Your Requirements
                </h3>
                
                {data.query.corrected && (
                  <div className="mb-4">
                    <span className="text-xs text-muted-foreground block mb-1">Search term</span>
                    <span className="text-sm font-medium">"{data.query.corrected}"</span>
                  </div>
                )}
                
                {data.query.category && (
                  <div className="mb-4">
                    <span className="text-xs text-muted-foreground block mb-1">Category</span>
                    <Badge variant="secondary" className="font-normal capitalize">{data.query.category.replace(/-/g, ' ')}</Badge>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground block">Constraints</span>
                  {Object.entries(data.query.constraints).map(([key, val]) => {
                    if (val === null) return null;
                    
                    let label = key;
                    if (key === 'budget' && val === 'free') label = 'Must be Free';
                    if (key === 'budget' && val === 'under_5') label = 'Under $5';
                    if (key === 'watermark' && val === false) label = 'No Watermark';
                    if (key === 'commercial_use' && val === true) label = 'Commercial Use';
                    if (key === 'no_code' && val === true) label = 'No-Code';
                    
                    return (
                      <Badge key={key} variant="outline" className="mr-1 mb-1 font-normal bg-background">
                        {label}
                      </Badge>
                    );
                  })}
                  {Object.values(data.query.constraints).every(v => v === null) && (
                    <span className="text-xs text-muted-foreground italic">None specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content (Results) */}
            <div className="lg:col-span-9 space-y-6">
              
              {/* Header */}
              <div className="flex items-end justify-between border-b pb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight mb-1">
                    {data.recommendation.best_match ? 'Top Recommendations' : 'Search Results'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {data.query.corrected 
                      ? <>Showing results for <span className="font-medium text-foreground">"{data.query.corrected}"</span></> 
                      : <>Showing results for <span className="font-medium text-foreground">"{data.query.raw}"</span></>
                    }
                  </p>
                </div>
                {data.source === 'live_discovery' && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Live Discovery Triggered
                  </Badge>
                )}
              </div>

              {/* No Results */}
              {!data.recommendation.best_match && data.results.length === 0 && data.cache_state !== 'DISCOVERY_IN_PROGRESS' && (
                <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                     <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No results found</h3>
                  <p className="text-sm text-muted-foreground/80 max-w-md">
                     {data.recommendation.explanation || "We couldn't find any tools matching your exact criteria."}
                  </p>
                  
                  {/* Show rate limit message if we know it was a provider failure */}
                  {data.cache_state === 'PROVIDER_FAILURE' && (
                     <div className="mt-6 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-3 rounded-md text-sm text-left max-w-md flex gap-3">
                       <AlertCircle className="w-5 h-5 shrink-0" />
                       <p>Live Discovery is currently limited by external API quotas or strict crawling protections. We are unable to fetch new tools right now.</p>
                     </div>
                  )}
                </div>
              )}

              {/* Best Match (Rank #1) */}
              {data.recommendation.best_match && (
                <div className="mb-8">
                  <ToolCard
                    tool={data.recommendation.best_match}
                    isBestMatch={true}
                    explanation={data.recommendation.explanation}
                    matchedConstraints={data.recommendation.best_match.matched_constraints}
                  />
                </div>
              )}

              {/* Alternatives (Ranks #2+) */}
              {data.results.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
                    {data.recommendation.best_match ? 'Strong Alternatives' : 'All Results'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.results.map((tool, idx) => (
                      <ToolCard
                         key={tool.id}
                        tool={tool}
                        rank={data.recommendation.best_match ? idx + 2 : idx + 1}
                        matchedConstraints={tool.matched_constraints}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
