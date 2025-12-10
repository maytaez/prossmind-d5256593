import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CombinedGenerationRequest {
    subPrompts: string[];
    diagramType: 'bpmn' | 'pid';
    userId: string;
    originalPrompt: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { subPrompts, diagramType, userId, originalPrompt }: CombinedGenerationRequest = await req.json();

        if (!subPrompts || !Array.isArray(subPrompts) || subPrompts.length === 0) {
            throw new Error('Sub-prompts array is required');
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Create a job record for tracking
        const { data: job, error: jobError } = await supabase
            .from('vision_bpmn_jobs')
            .insert({
                user_id: userId,
                status: 'processing',
                image_data: originalPrompt,
            })
            .select()
            .single();

        if (jobError || !job) {
            throw new Error('Failed to create job record');
        }

        console.log(`[Combined Generation] Created job ${job.id} for ${subPrompts.length} sub-prompts`);

        // Start async processing (fire and forget)
        processCombinedGeneration(job.id, subPrompts, diagramType, originalPrompt, supabase).catch((error) => {
            console.error(`[Combined Generation] Error processing job ${job.id}:`, error);
            // Update job status to failed
            supabase
                .from('vision_bpmn_jobs')
                .update({
                    status: 'failed',
                    error_message: error.message || 'Unknown error during combined generation',
                })
                .eq('id', job.id)
                .then(() => console.log(`[Combined Generation] Job ${job.id} marked as failed`));
        });

        // Return job ID immediately
        return new Response(
            JSON.stringify({
                jobId: job.id,
                message: `Processing ${subPrompts.length} sub-prompts. This may take 2-5 minutes.`,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[Combined Generation] Error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});

async function processCombinedGeneration(
    jobId: string,
    subPrompts: string[],
    diagramType: 'bpmn' | 'pid',
    originalPrompt: string,
    supabase: any
) {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
        throw new Error('Google API key not configured');
    }

    console.log(`[Combined Generation] Starting processing for job ${jobId}`);

    try {
        // Generate BPMN for each sub-prompt
        const subDiagrams: string[] = [];

        for (let i = 0; i < subPrompts.length; i++) {
            const subPrompt = subPrompts[i];
            console.log(`[Combined Generation] Generating sub-diagram ${i + 1}/${subPrompts.length}`);

            // Call generate-bpmn for each sub-prompt
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

            const response = await fetch(`${supabaseUrl}/functions/v1/generate-bpmn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                },
                body: JSON.stringify({
                    prompt: subPrompt,
                    diagramType,
                    skipCache: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Combined Generation] Sub-diagram ${i + 1} failed:`, errorText);
                continue; // Skip failed sub-diagrams
            }

            const data = await response.json();
            if (data.bpmnXml) {
                subDiagrams.push(data.bpmnXml);
            }
        }

        if (subDiagrams.length === 0) {
            throw new Error('Failed to generate any sub-diagrams');
        }

        console.log(`[Combined Generation] Generated ${subDiagrams.length}/${subPrompts.length} sub-diagrams`);

        // Combine all sub-diagrams using AI
        const combinedBpmn = await combineSubDiagrams(subDiagrams, originalPrompt, diagramType, GOOGLE_API_KEY);

        // Update job with result
        const { error: updateError } = await supabase
            .from('vision_bpmn_jobs')
            .update({
                status: 'completed',
                bpmn_xml: combinedBpmn,
            })
            .eq('id', jobId);

        if (updateError) {
            throw updateError;
        }

        console.log(`[Combined Generation] Job ${jobId} completed successfully`);
    } catch (error) {
        console.error(`[Combined Generation] Job ${jobId} failed:`, error);
        throw error;
    }
}

async function combineSubDiagrams(
    subDiagrams: string[],
    originalPrompt: string,
    diagramType: 'bpmn' | 'pid',
    googleApiKey: string
): Promise<string> {
    console.log(`[Combine] Merging ${subDiagrams.length} sub-diagrams`);

    const combinePrompt = `You are a BPMN expert. Combine these ${subDiagrams.length} BPMN sub-diagrams into a single comprehensive diagram.

ORIGINAL WORKFLOW DESCRIPTION:
${originalPrompt}

SUB-DIAGRAMS TO COMBINE:
${subDiagrams.map((xml, i) => `\n--- Sub-Diagram ${i + 1} ---\n${xml}\n`).join('\n')}

INSTRUCTIONS:
1. Merge all processes, tasks, events, and gateways from all sub-diagrams
2. Create proper sequence flows connecting the sub-processes
3. Use swimlanes/pools to organize different phases or actors
4. Ensure all element IDs are unique across the combined diagram
5. Maintain proper BPMN 2.0 structure with diagram interchange (DI)
6. Connect the end events of one sub-process to the start events of the next
7. Preserve all important details from each sub-diagram

Return ONLY the combined BPMN 2.0 XML, no markdown formatting.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinePrompt }] }],
                generationConfig: {
                    maxOutputTokens: 100000,
                    temperature: 0.2,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    let combinedXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!combinedXml) {
        throw new Error('No combined BPMN generated');
    }

    // Clean up the XML
    combinedXml = combinedXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    console.log(`[Combine] Successfully combined into ${combinedXml.length} chars`);
    return combinedXml;
}
