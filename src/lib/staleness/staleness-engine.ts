import { createClient } from '../supabase/server';

export class StalenessEngine {
  // Configurable TTLs in days
  static TTL_CONFIG = {
    pricing: 3,      // Pricing should be checked every 3 days
    features: 7,     // Features every 7 days
    reviews: 7,      // Reviews every 7 days
    company: 30      // Company info every 30 days
  };

  /**
   * Evaluates the staleness of a tool's data and triggers re-verification jobs if needed.
   * Returns a freshness score from 0 to 100.
   */
  static async evaluateStaleness(toolId: string): Promise<number> {
    const supabase = await createClient();

    const { data: tool } = await supabase
      .from('tools')
      .select('last_verified_at')
      .eq('id', toolId)
      .single();

    if (!tool || !tool.last_verified_at) {
      return 0; // Completely stale / unverified
    }

    const daysSinceVerified = (Date.now() - new Date(tool.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
    
    // Freshness score calculation
    let freshnessScore = 100;
    
    if (daysSinceVerified > 90) freshnessScore = 0;
    else if (daysSinceVerified > 30) freshnessScore = 20;
    else if (daysSinceVerified > 14) freshnessScore = 50;
    else if (daysSinceVerified > 7) freshnessScore = 75;

    // Check specific evidence types to queue targeted jobs
    const { data: evidence } = await supabase
      .from('evidence')
      .select('id, claim_type, collected_at')
      .eq('tool_id', toolId)
      .order('collected_at', { ascending: false });

    if (evidence) {
      let needsPricingUpdate = false;
      let needsFeatureUpdate = false;

      const latestPricing = evidence.find(e => e.claim_type === 'pricing');
      if (latestPricing && latestPricing.collected_at) {
        const pricingAge = (Date.now() - new Date(latestPricing.collected_at).getTime()) / (1000 * 60 * 60 * 24);
        if (pricingAge > this.TTL_CONFIG.pricing) needsPricingUpdate = true;
      } else {
        needsPricingUpdate = true; // No pricing evidence
      }

      const latestFeature = evidence.find(e => e.claim_type === 'feature');
      if (latestFeature && latestFeature.collected_at) {
        const featureAge = (Date.now() - new Date(latestFeature.collected_at).getTime()) / (1000 * 60 * 60 * 24);
        if (featureAge > this.TTL_CONFIG.features) needsFeatureUpdate = true;
      } else {
        needsFeatureUpdate = true; // No feature evidence
      }

      // If needed, we queue specific extraction/verification jobs
      if (needsPricingUpdate || needsFeatureUpdate) {
        // Queue verification job
        await supabase.from('automation_jobs').insert({
          job_type: 'verify',
          status: 'pending',
          priority: 5,
          payload: {
            tool_id: toolId,
            verify_pricing: needsPricingUpdate,
            verify_features: needsFeatureUpdate
          },
          scheduled_at: new Date().toISOString()
        });
      }
    }

    return freshnessScore;
  }
}
