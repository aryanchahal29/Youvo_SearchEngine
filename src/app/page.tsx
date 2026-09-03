import { SearchBar } from "@/components/search/SearchBar";
import { Sparkles, ArrowRight, ShieldCheck, Zap, LineChart } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  
  // Fetch top featured/recommended tools for the homepage
  const { data: featuredTools } = await supabase
    .from('tools')
    .select('id, name, slug, short_description, logo_url')
    .eq('is_featured', true)
    .limit(6);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
      {/* Hero Section */}
      <section className="w-full max-w-4xl mx-auto flex flex-col items-center text-center mt-12 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          <span>The evidence-based AI tool engine</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-8 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent leading-[1.1]">
          Stop guessing.<br />
          Find the <span className="text-primary">perfect AI tool</span>.
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl text-balance font-medium leading-relaxed">
          Tell us what you want to accomplish. We analyze pricing, features, and real user reviews to find the best tools for your specific situation.
        </p>

        {/* Search Bar - Centerpiece */}
        <div className="w-full max-w-3xl relative z-10">
          <SearchBar variant="hero" autoFocus />
        </div>
      </section>

      {/* Value Propositions */}
      <section className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Personalized Matching</h3>
          <p className="text-base text-muted-foreground">
            We don't just show a list. We understand your budget, skill level, and exact requirements.
          </p>
        </div>
        
        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Evidence-Based</h3>
          <p className="text-base text-muted-foreground">
            Every claim is backed by sources. We check pricing, limits, and real capabilities.
          </p>
        </div>
        
        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-sky-400/10 text-sky-400 flex items-center justify-center mb-4">
            <LineChart className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Transparent Scoring</h3>
          <p className="text-base text-muted-foreground">
            Our 0-100 score breaks down relevance, value, ease of use, and reputation.
          </p>
        </div>
      </section>

      {/* Featured Tools (if any exist in DB) */}
      {featuredTools && featuredTools.length > 0 && (
        <section className="w-full max-w-5xl mx-auto mb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Trending Tools</h2>
            <Link href="/categories" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              Explore categories <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {featuredTools.map(tool => (
              <Link 
                key={tool.id} 
                href={`/tools/${tool.slug}`}
                className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {tool.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tool.logo_url} alt={tool.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="font-bold text-muted-foreground">{tool.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{tool.short_description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
