/**
 * Cache utility functions for BPMN/P&ID generation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

/**
 * Generate SHA-256 hash of a string
 */
export async function generateHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check exact hash cache for prompt
 */
export async function checkExactHashCache(
  promptHash: string,
  diagramType: string
): Promise<{ bpmnXml: string; cacheId: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('bpmn_prompt_cache')
    .select('id, bpmn_xml')
    .eq('prompt_hash', promptHash)
    .eq('diagram_type', diagramType)
    .single();

  if (error || !data) {
    return null;
  }

  // Update hit count and last accessed time
  await supabase.rpc('update_cache_access', { cache_id: data.id });

  return { bpmnXml: data.bpmn_xml, cacheId: data.id };
}

/**
 * Store result in exact hash cache
 */
export async function storeExactHashCache(
  promptHash: string,
  promptText: string,
  diagramType: string,
  bpmnXml: string,
  embedding?: number[]
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Convert embedding array to PostgreSQL vector format
  const embeddingVector = embedding ? `[${embedding.join(',')}]` : null;

  const { error } = await supabase
    .from('bpmn_prompt_cache')
    .upsert({
      prompt_hash: promptHash,
      prompt_text: promptText,
      diagram_type: diagramType,
      bpmn_xml: bpmnXml,
      prompt_embedding: embeddingVector,
      last_accessed_at: new Date().toISOString(),
    }, {
      onConflict: 'prompt_hash,diagram_type',
    });

  if (error) {
    console.error('Failed to store in cache:', error);
  }
}

/**
 * Check semantic similarity cache
 */
export async function checkSemanticCache(
  embedding: number[],
  diagramType: string,
  threshold: number = 0.85
): Promise<{ bpmnXml: string; similarity: number; cacheId: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Convert embedding array to PostgreSQL vector format
  const embeddingVector = `[${embedding.join(',')}]`;

  const { data, error } = await supabase.rpc('match_similar_prompts', {
    query_embedding: embeddingVector,
    match_threshold: threshold,
    match_count: 1,
    diagram_type_filter: diagramType,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const bestMatch = data[0];
  
  // Update hit count
  await supabase.rpc('update_cache_access', { cache_id: bestMatch.id });

  return {
    bpmnXml: bestMatch.bpmn_xml,
    similarity: bestMatch.similarity,
    cacheId: bestMatch.id,
  };
}

/**
 * Check vision analysis cache for image
 */
export async function checkVisionCache(
  imageHash: string,
  diagramType: string
): Promise<{ processDescription: string; bpmnXml?: string; cacheId: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('Vision cache check skipped: missing Supabase config');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('vision_analysis_cache')
      .select('id, process_description, bpmn_xml, hit_count')
      .eq('image_hash', imageHash)
      .eq('diagram_type', diagramType)
      .maybeSingle();

    if (error) {
      console.error('Vision cache lookup error:', error);
      return null;
    }

    if (!data) {
      console.log('Vision cache: No match found for image hash');
      return null;
    }

    console.log('Vision cache: Found match! Cache ID:', data.id, 'Hit count:', data.hit_count);

    // Update hit count and last accessed time
    const { error: updateError } = await supabase.rpc('update_vision_cache_access', { cache_id: data.id });
    if (updateError) {
      console.error('Failed to update vision cache hit count:', updateError);
    }

    return {
      processDescription: data.process_description,
      bpmnXml: data.bpmn_xml || undefined,
      cacheId: data.id,
    };
  } catch (err) {
    console.error('Vision cache check exception:', err);
    return null;
  }
}

/**
 * Store vision analysis result in cache
 */
export async function storeVisionCache(
  imageHash: string,
  diagramType: string,
  processDescription: string,
  bpmnXml?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('Vision cache storage skipped: missing Supabase config');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Storing vision cache entry:', {
      hashPrefix: imageHash.substring(0, 16) + '...',
      diagramType,
      descriptionLength: processDescription.length,
      hasBpmnXml: !!bpmnXml,
      bpmnXmlLength: bpmnXml?.length || 0
    });

    const { error } = await supabase
      .from('vision_analysis_cache')
      .upsert({
        image_hash: imageHash,
        diagram_type: diagramType,
        process_description: processDescription,
        bpmn_xml: bpmnXml || null,
        last_accessed_at: new Date().toISOString(),
      }, {
        onConflict: 'image_hash,diagram_type',
      });

    if (error) {
      console.error('Failed to store vision cache:', error);
      throw error;
    }

    console.log('Vision cache stored successfully');
  } catch (err) {
    console.error('Vision cache storage exception:', err);
  }
}

