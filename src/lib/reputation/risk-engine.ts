import { createClient } from '../supabase/server';
import { Database } from '../supabase/types';

export interface RiskAnalysis {
  risk_level: 'low' | 'moderate' | 'elevated' | 'insufficient_evidence';
  risk_penalty: number; // 0 to 100
  reasons: string[];
}

export class RiskEngine {
  /**
   * Analyzes the risk profile of a tool.
   * Looks at reviews, staleness, missing evidence, and tool status.
   */
  static async analyzeRisk(toolId: string): Promise<RiskAnalysis> {
    const supabase = await createClient();

    const analysis: RiskAnalysis = {
      risk_level: 'low',
      risk_penalty: 0,
      reasons: []
    };

    // 1. Fetch tool base info
    const { data: tool } = await supabase
      .from('tools')
      .select('status, last_verified_at, created_at')
      .eq('id', toolId)
      .single();

    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    // High risk base statuses
    if (tool.status === 'dead' || tool.status === 'discontinued') {
      analysis.risk_level = 'elevated';
      analysis.risk_penalty += 100;
      analysis.reasons.push(`Tool is marked as ${tool.status}.`);
      return analysis; // Max penalty reached
    }

    // 2. Check stale data
    if (tool.last_verified_at) {
      const daysSinceVerified = (Date.now() - new Date(tool.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceVerified > 90) {
        analysis.risk_penalty += 20;
        analysis.risk_level = 'moderate';
        analysis.reasons.push(`Information has not been verified in over 90 days.`);
      } else if (daysSinceVerified > 30) {
        analysis.risk_penalty += 5;
        analysis.reasons.push(`Information has not been verified in over 30 days.`);
      }
    } else {
      analysis.risk_penalty += 10;
      analysis.reasons.push(`Tool has never been officially verified.`);
    }

    // 3. Check for severe complaints in reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('sentiment, complaint_category')
      .eq('tool_id', toolId)
      .in('sentiment', ['negative', 'mixed']);

    if (reviews && reviews.length > 0) {
      let billingComplaints = 0;
      let scamComplaints = 0;
      let downtimeComplaints = 0;

      for (const review of reviews) {
        if (review.complaint_category === 'billing') billingComplaints++;
        if (review.complaint_category === 'scam' || review.complaint_category === 'fraud') scamComplaints++;
        if (review.complaint_category === 'downtime') downtimeComplaints++;
      }

      if (scamComplaints > 0) {
        analysis.risk_penalty += 40;
        analysis.risk_level = 'elevated';
        analysis.reasons.push(`Multiple signals indicating severe trust or fraud issues.`);
      }
      
      if (billingComplaints > 1) {
        analysis.risk_penalty += 20;
        analysis.risk_level = analysis.risk_level === 'low' ? 'moderate' : analysis.risk_level;
        analysis.reasons.push(`Elevated level of billing-related complaints.`);
      }

      if (downtimeComplaints > 2) {
        analysis.risk_penalty += 10;
        analysis.reasons.push(`Frequent reports of downtime or instability.`);
      }
    }

    // 4. Missing basic evidence
    const { count: evidenceCount } = await supabase
      .from('evidence')
      .select('*', { count: 'exact', head: true })
      .eq('tool_id', toolId);

    if (evidenceCount === 0) {
      analysis.risk_level = 'insufficient_evidence';
      analysis.risk_penalty += 15;
      analysis.reasons.push(`No verified evidence available for this tool.`);
    }

    // Normalize risk level
    if (analysis.risk_level !== 'insufficient_evidence') {
      if (analysis.risk_penalty >= 30) {
        analysis.risk_level = 'elevated';
      } else if (analysis.risk_penalty >= 15) {
        analysis.risk_level = 'moderate';
      }
    }

    analysis.risk_penalty = Math.min(100, analysis.risk_penalty);

    return analysis;
  }
}
