import { createClient } from '@supabase/supabase-js';
import { getAIRouter } from '../src/lib/providers/router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Generating embeddings for all tools...");
  
  const { data: tools, error } = await supabase.from('tools').select('id, name, description, short_description');
  if (error) throw error;
  
  const router = getAIRouter();
  
  for (const tool of tools) {
    const textToEmbed = `${tool.name} ${tool.short_description || ''} ${tool.description || ''}`;
    console.log(`Embedding ${tool.name}...`);
    
    try {
      const embedding = await router.generateEmbedding(textToEmbed);
      
      await supabase.from('tool_embeddings').upsert({
        tool_id: tool.id,
        embedding: embedding,
        embedding_model: 'gemini-embedding-exp-03-07',
        embedding_dimensions: embedding.length,
      }, { onConflict: 'tool_id' });
      
      console.log(`Success for ${tool.name}`);
    } catch (e) {
      console.error(`Failed to embed ${tool.name}:`, e);
    }
  }
  
  console.log("Done generating embeddings.");
}

main().catch(console.error);
