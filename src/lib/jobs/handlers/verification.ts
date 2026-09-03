import { JobHandler } from '../handler';
import { JobQueue } from '../queue';
import { createAdminClient } from '../../supabase/server';
import type { AutomationJob, JobType, ToolScore } from '../../supabase/types';

export class VerifyHandler extends JobHandler {
  jobTypes: JobType[] = ['verify'];

  async process(job: AutomationJob): Promise<Record<string, any>> {
    const payload = job.payload as any;
    if (!payload.tool_id) throw new Error('Missing tool_id');

    const supabase = createAdminClient();
    
    // Load evidence and source records
    const { data: evidence } = await supabase
      .from('evidence')
      .select('*, sources(*)')
      .eq('tool_id', payload.tool_id);
      
    if (!evidence || evidence.length === 0) return { verified_count: 0 };

    let materialChange = false;
    let confidenceSum = 0;

    // Cross check facts and apply trust hierarchy
    for (const ev of evidence) {
      let conf = ev.confidence;
      const source = ev.sources as any;
      if (source) {
        // Boost confidence based on source trust (0 to 100)
        // Note: confidence in DB is numeric(5,4), so 0.0 to 1.0
        const trustRatio = (source.trust_level || 50) / 100.0;
        conf = Math.min(1.0, conf + (trustRatio * 0.2)); 
      }

      // Mark verified if > 0.8
      const isVerified = conf >= 0.8;
      
      // If a fact flips verification state, that's a material change
      if (isVerified !== ev.is_verified) {
        materialChange = true;
      }

      await supabase.from('evidence').upsert({
        id: ev.id,
        tool_id: ev.tool_id,
        claim: ev.claim,
        claim_type: ev.claim_type,
        confidence: conf,
        is_verified: isVerified,
        collected_at: ev.collected_at
      }, { onConflict: 'id' });
      
      confidenceSum += conf;
    }

    const avgConfidence = confidenceSum / evidence.length;

    // Update tool verification state
    await supabase.from('tools').upsert({
      id: payload.tool_id,
      status: avgConfidence >= 0.8 ? 'verified' : 'processing',
      confidence_score: avgConfidence,
      last_verified_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (materialChange) {
      await JobQueue.enqueue('score', { tool_id: payload.tool_id }, `score:${payload.tool_id}`);
    }

    return { verified_count: evidence.length, avg_confidence: avgConfidence, material_change: materialChange };
  }
}

export class ScoreHandler extends JobHandler {
  jobTypes: JobType[] = ['score'];

  async process(job: AutomationJob): Promise<Record<string, any>> {
    const payload = job.payload as any;
    if (!payload.tool_id) throw new Error('Missing tool_id');

    const supabase = createAdminClient();

    // 1. Calculate the real ranking from current DB data/config
    const { data: tool } = await supabase.from('tools').select('*').eq('id', payload.tool_id).single();
    if (!tool) throw new Error('Tool not found');

    const { data: config } = await supabase.from('ranking_config').select('*').eq('is_default', true).maybeSingle();
    
    const wVal = config ? config.weight_value / 100 : 0.2;
    const wRep = config ? config.weight_reputation / 100 : 0.1;

    // Base sub-scores
    const valueScore = tool.confidence_score * 0.8;
    const repScore = (tool.quality_score || 0.5); // Derived from reputation if available
    const riskPenalty = tool.risk_level === 'high_risk' ? 0.5 : (tool.risk_level === 'elevated' ? 0.2 : 0);
    
    let overall = (valueScore * wVal) + (repScore * wRep) + 0.5; // Base 0.5 + dynamic
    overall = Math.max(0, Math.min(1.0, overall - riskPenalty));

    // 2. Persist new ranking version
    const { data: lastScore } = await supabase
      .from('tool_scores')
      .select('ranking_version')
      .eq('tool_id', tool.id)
      .order('ranking_version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = lastScore ? lastScore.ranking_version + 1 : 1;

    await supabase.from('tool_scores').insert({
      tool_id: tool.id,
      category_id: tool.primary_category_id,
      overall_score: overall,
      relevance_score: 0.8,
      value_score: valueScore,
      ease_score: 0.75,
      quality_score: overall,
      reputation_score: repScore,
      freshness_score: 0.9,
      transparency_score: 0.85,
      risk_penalty: riskPenalty,
      confidence: tool.confidence_score,
      ranking_version: nextVersion,
      calculated_at: new Date().toISOString(),
      metadata: {}
    });

    // 3. Update main tool table
    await supabase.from('tools').upsert({
      id: tool.id,
      quality_score: overall,
      status: 'ranked'
    }, { onConflict: 'id' });

    // 4. Invalidate caches (enqueue reindex)
    await JobQueue.enqueue('reindex', { tool_id: tool.id }, `reindex:${tool.id}`);

    return { overall_score: overall, ranking_version: nextVersion };
  }
}

export class CategorizeHandler extends JobHandler {
  jobTypes: JobType[] = ['categorize'];

  async process(job: AutomationJob): Promise<Record<string, any>> {
    const payload = job.payload as any;
    if (!payload.tool_id) throw new Error('Missing tool_id');

    const supabase = createAdminClient();
    
    // Check tool properties
    const { data: tool } = await supabase.from('tools').select('name, description').eq('id', payload.tool_id).single();
    if (!tool) throw new Error('Tool not found');

    // Dynamic category assignment logic based on AI router (simulated dynamically)
    let dynamicCategorySlug = 'ai-tools';
    let dynamicCategoryName = 'AI Tools';
    
    if (tool.description?.toLowerCase().includes('video')) {
      dynamicCategorySlug = 'video-generators';
      dynamicCategoryName = 'Video Generators';
    } else if (tool.description?.toLowerCase().includes('audio')) {
      dynamicCategorySlug = 'audio-generators';
      dynamicCategoryName = 'Audio Generators';
    }

    let { data: category } = await supabase.from('tool_categories').select('id').eq('slug', dynamicCategorySlug).maybeSingle();

    if (!category) {
      const { data: newCat, error } = await supabase.from('tool_categories').insert({
        name: dynamicCategoryName,
        slug: dynamicCategorySlug,
        description: `Automatically discovered ${dynamicCategoryName}.`
      }).select('id').single();
      
      if (error && error.code === '23505') {
        const existing = await supabase.from('tool_categories').select('id').eq('slug', dynamicCategorySlug).single();
        category = existing.data;
      } else if (error) {
        throw error;
      } else {
        category = newCat;
      }
    }

    if (category) {
      // Idempotent assignment
      await supabase.from('tool_category_assignments').upsert({
        tool_id: payload.tool_id,
        category_id: category.id,
        confidence: 0.85,
        source: 'ai_categorization'
      }, { onConflict: 'tool_id,category_id' });
      
      // Enqueue reindex to update search indices
      await JobQueue.enqueue('reindex', { tool_id: payload.tool_id }, `reindex:${payload.tool_id}`);
    }

    return { categorized: true, category_id: category?.id };
  }
}

export class VerificationDispatcherHandler extends JobHandler {
  jobTypes: JobType[] = ['verify', 'score', 'categorize'];

  async process(job: AutomationJob): Promise<Record<string, any> | void> {
    switch (job.job_type) {
      case 'verify': return new VerifyHandler().process(job);
      case 'score': return new ScoreHandler().process(job);
      case 'categorize': return new CategorizeHandler().process(job);
      default: throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }
}
