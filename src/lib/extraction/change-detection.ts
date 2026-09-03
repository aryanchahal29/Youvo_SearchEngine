import { createClient } from '../supabase/server';
import { createHash } from 'crypto';

export class ChangeDetection {
  /**
   * Compares the new content hash with the previous hash.
   * If it changed, updates the hash and returns true to trigger re-extraction.
   */
  static async detectChange(sourceId: string, content: string): Promise<boolean> {
    const supabase = await createClient();

    // Create a simple SHA-256 hash of the cleaned content
    const hash = createHash('sha256').update(content).digest('hex');

    const { data: source } = await supabase
      .from('sources')
      .select('content_hash')
      .eq('id', sourceId)
      .single();

    if (!source || source.content_hash !== hash) {
      // Content has changed
      await supabase
        .from('sources')
        .update({ content_hash: hash, last_checked_at: new Date().toISOString() })
        .eq('id', sourceId);
      
      return true;
    }

    // No change
    await supabase
      .from('sources')
      .update({ last_checked_at: new Date().toISOString() })
      .eq('id', sourceId);
      
    return false;
  }
}
