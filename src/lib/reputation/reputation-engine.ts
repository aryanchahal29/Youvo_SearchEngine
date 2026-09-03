import { createClient } from '../supabase/server';
import { Database } from '../supabase/types';

export class ReputationEngine {
  /**
   * Calculates a reputation score for a tool based on its reviews and sentiment analysis.
   */
  static async calculateReputation(toolId: string): Promise<number> {
    const supabase = await createClient();

    // Fetch all reviews for this tool
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('sentiment, sentiment_score, rating, source_id')
      .eq('tool_id', toolId);

    if (error) {
      console.error('Failed to fetch reviews for reputation calculation:', error);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return 50; // Neutral baseline if no data
    }

    let totalScore = 0;
    let totalWeight = 0;

    // Optional: fetch sources to weigh by trust_level
    const sourceIds = [...new Set(reviews.map(r => r.source_id).filter(Boolean))] as string[];
    let sourcesMap: Record<string, number> = {};
    
    if (sourceIds.length > 0) {
      const { data: sources } = await supabase
        .from('sources')
        .select('id, trust_level')
        .in('id', sourceIds);
      
      if (sources) {
        sourcesMap = sources.reduce((acc, src) => {
          acc[src.id] = src.trust_level;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    for (const review of reviews) {
      // Base score on sentiment_score if available (0-100), otherwise derive from sentiment or rating
      let score = 50;
      if (review.sentiment_score !== null) {
        score = review.sentiment_score;
      } else if (review.rating !== null) {
        // Convert 1-5 rating to 0-100
        score = (review.rating - 1) * 25;
      } else {
        switch (review.sentiment) {
          case 'positive': score = 85; break;
          case 'negative': score = 20; break;
          case 'mixed': score = 50; break;
          case 'neutral': score = 50; break;
        }
      }

      // Weigh by source trust level if available, otherwise default to 1.0
      const weight = (review.source_id && sourcesMap[review.source_id]) 
        ? sourcesMap[review.source_id] / 50.0 // Assuming trust_level is 0-100
        : 1.0; 
      
      totalScore += score * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 50;
    
    const reputationScore = Math.min(100, Math.max(0, Math.round(totalScore / totalWeight)));

    return reputationScore;
  }
}
