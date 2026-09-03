import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase.from('tool_categories').select('*').eq('slug', params.slug).single();
  
  if (!data) return { title: 'Not Found' };

  return {
    title: `Best ${data.name} AI Tools - YouVo`,
    description: data.description || `Discover and compare the best ${data.name} AI tools on YouVo.`,
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data: category } = await supabase.from('tool_categories').select('*').eq('slug', params.slug).single();
  
  if (!category) notFound();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight mb-4">Best {category.name} Tools</h1>
      <p className="text-muted-foreground mb-8">{category.description}</p>
      
      <div className="bg-card rounded-xl p-8 border shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">Category results coming soon</h2>
        <p className="text-muted-foreground mb-4">We are still classifying tools for this category.</p>
        <Link href="/search" className="text-primary hover:underline">Return to Search</Link>
      </div>
    </div>
  );
}
