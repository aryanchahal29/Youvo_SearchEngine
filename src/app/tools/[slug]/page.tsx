import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Check, X, Building, Globe, Calendar, ShieldCheck, Activity, Search } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreBadge, ConfidenceIndicator, FreshnessIndicator } from "@/components/tool/ToolCard";
import type { ToolWithDetails, Evidence, Review } from "@/lib/supabase/types";
import { Metadata } from "next";

// This is a Server Component. We fetch directly from the local API route.
async function getTool(slug: string): Promise<(ToolWithDetails & { evidence: Evidence[], reviews: Review[] }) | null> {
  const headers = new Headers();
  // We don't have absolute URL in server components easily unless we construct it, 
  // but since we're in the same Next.js app, we can just call the server-side logic directly or fetch localhost.
  // It's cleaner to just fetch the absolute URL if we pass it, but simpler to use the API route via full URL.
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
    
  const res = await fetch(`${baseUrl}/api/tools/${slug}`, { 
    next: { revalidate: 60 } // Cache for 60s
  });
  
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch tool');
  }
  
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tool = await getTool(params.slug);
  if (!tool) return { title: 'Not Found' };

  return {
    title: `${tool.name} - Reviews, Pricing & Features | YouVo`,
    description: tool.short_description || tool.description?.substring(0, 160),
    openGraph: {
      title: `${tool.name} on YouVo`,
      description: tool.short_description || tool.description?.substring(0, 160),
      url: `https://youvo.ai/tools/${tool.slug}`,
      images: tool.logo_url ? [{ url: tool.logo_url }] : [],
    },
    twitter: {
      card: 'summary',
      title: `${tool.name} on YouVo`,
      description: tool.short_description || tool.description?.substring(0, 160),
      images: tool.logo_url ? [tool.logo_url] : [],
    },
  };
}

export default async function ToolProfilePage({ params }: { params: { slug: string } }) {
  const tool = await getTool(params.slug);

  if (!tool) {
    notFound();
  }

  const score = tool.latest_score?.overall_score ?? tool.quality_score ?? 0;
  const confidence = tool.latest_score?.confidence ?? tool.confidence_score ?? 0;

  const freePlan = tool.pricing_plans.find(p => p.is_free);
  const paidPlans = tool.pricing_plans.filter(p => !p.is_free).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  // Generate structured JSON-LD data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    url: tool.official_url || `https://youvo.ai/tools/${tool.slug}`,
    applicationCategory: tool.categories?.[0]?.name || 'Software',
    description: tool.description || tool.short_description,
    image: tool.logo_url,
    offers: tool.pricing_plans.map(plan => ({
      '@type': 'Offer',
      price: plan.price || 0,
      priceCurrency: plan.currency || 'USD',
      name: plan.plan_name,
    })),
    aggregateRating: tool.latest_score ? {
      '@type': 'AggregateRating',
      ratingValue: Math.round(tool.latest_score.overall_score) / 20, // 0-5 scale
      bestRating: '5',
      worstRating: '1',
      ratingCount: 1, // Represents our single trusted score
    } : undefined,
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <Link href="/search" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold hover:text-primary transition-colors">
              YouVo
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Top Section: Identity & Core Score */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-card border shadow-sm flex items-center justify-center shrink-0">
            {tool.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.logo_url} alt={tool.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">{tool.name.charAt(0)}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{tool.name}</h1>
              {tool.status === 'verified' && (
                <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-500 hover:bg-emerald-400/20">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
            
            <p className="text-lg text-muted-foreground mb-4 max-w-2xl">
              {tool.description || tool.short_description}
            </p>
            
            <div className="flex flex-wrap gap-4 items-center">
              {tool.official_url && (
                <a 
                  href={tool.official_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Visit Website <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              )}
              
              <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-xl border shadow-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">YouVo Score</span>
                  <ScoreBadge score={score} />
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div className="flex flex-col gap-1">
                  <ConfidenceIndicator confidence={confidence} />
                  <FreshnessIndicator lastVerified={tool.last_verified_at} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start h-12 bg-transparent border-b rounded-none p-0">
            <TabsTrigger value="overview" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6">Overview</TabsTrigger>
            <TabsTrigger value="pricing" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6">Pricing & Value</TabsTrigger>
            <TabsTrigger value="evidence" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6">Evidence Log</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="pt-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tool.features.length > 0 ? (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {tool.features.map(f => (
                          <li key={f.id} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <span className="text-sm">{f.feature_name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Feature data currently being extracted.</p>
                    )}
                  </CardContent>
                </Card>

                {tool.latest_score && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Score Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground uppercase">Relevance</span>
                          <span className="text-xl font-bold">{Math.round(tool.latest_score.relevance_score)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground uppercase">Value</span>
                          <span className="text-xl font-bold">{Math.round(tool.latest_score.value_score)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground uppercase">Capability</span>
                          <span className="text-xl font-bold">{Math.round(tool.latest_score.quality_score)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground uppercase">Ease of Use</span>
                          <span className="text-xl font-bold">{Math.round(tool.latest_score.ease_score)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Company Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tool.company_name && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span>{tool.company_name}</span>
                      </div>
                    )}
                    {tool.country && (
                      <div className="flex items-center gap-3 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span>{tool.country}</span>
                      </div>
                    )}
                    {tool.launch_date && (
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Launched {new Date(tool.launch_date).getFullYear()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="capitalize text-muted-foreground">Status: <span className="text-foreground">{tool.status}</span></span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {tool.categories.map(c => (
                        <Link key={c.id} href={`/search?q=${c.name}`}>
                          <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">{c.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="pricing" className="pt-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Free Plan Card */}
              {freePlan && (
                <Card className="border-emerald-500/20 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-emerald-400"></div>
                  <CardHeader>
                    <Badge variant="outline" className="w-fit mb-2 text-emerald-500 border-emerald-500/30">Free Tier</Badge>
                    <CardTitle className="text-2xl">{freePlan.plan_name}</CardTitle>
                    <div className="text-3xl font-bold mt-2">$0</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {freePlan.free_credits && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{freePlan.free_credits} {freePlan.credit_period || 'credits'}</span>
                        </li>
                      )}
                      {freePlan.watermark !== null && (
                        <li className="flex items-start gap-2 text-sm">
                          {freePlan.watermark ? <X className="w-4 h-4 text-red-400 shrink-0" /> : <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          <span className={freePlan.watermark ? "text-muted-foreground" : ""}>
                            {freePlan.watermark ? "Watermarked output" : "No watermark"}
                          </span>
                        </li>
                      )}
                      {freePlan.commercial_use !== null && (
                        <li className="flex items-start gap-2 text-sm">
                          {freePlan.commercial_use ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />}
                          <span className={!freePlan.commercial_use ? "text-muted-foreground" : ""}>
                            {freePlan.commercial_use ? "Commercial use allowed" : "No commercial use"}
                          </span>
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Paid Plans */}
              {paidPlans.map(plan => (
                <Card key={plan.id} className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.plan_name}</CardTitle>
                    <div className="text-3xl font-bold mt-2">
                      ${plan.price} <span className="text-base font-normal text-muted-foreground">/ {plan.billing_period === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plan.raw_description && (
                      <p className="text-sm text-muted-foreground">{plan.raw_description}</p>
                    )}
                    <ul className="space-y-2">
                      {plan.usage_limit && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{plan.usage_limit}</span>
                        </li>
                      )}
                      {plan.commercial_use && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Commercial use</span>
                        </li>
                      )}
                      {plan.api_access && (
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>API Access</span>
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {tool.pricing_plans.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
                No pricing data has been extracted yet.
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="evidence" className="pt-6 outline-none">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Verification Log</CardTitle>
                  <Badge variant="secondary" className="font-normal">
                    <Search className="w-3 h-3 mr-1" /> {tool.evidence.length} facts verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {tool.evidence.length > 0 ? (
                  <div className="space-y-4">
                    {tool.evidence.map(ev => (
                      <div key={ev.id} className="flex gap-4 p-4 rounded-lg bg-muted/30 border">
                        <div className="mt-0.5">
                          <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{ev.claim_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(ev.collected_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{ev.claim}</p>
                          {ev.evidence_text && (
                            <p className="text-xs text-muted-foreground mt-2 border-l-2 border-border pl-2 italic">
                              "{ev.evidence_text}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Evidence is currently being collected for this tool.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
        </Tabs>
      </main>
    </div>
  );
}
