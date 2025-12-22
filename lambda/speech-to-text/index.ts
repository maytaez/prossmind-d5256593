import { serve } from '../shared/aws-shim';

import { serve } from 'https://deno.land/std@0.168.0/http/server';

const openaiApiKey = process.env['OPENAI_API_KEY'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Sending audio to OpenAI Whisper...');

    // Convert base64 to Uint8Array
    const binaryData = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([binaryData], { type: 'audio/webm' });
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    
    // Send audio to OpenAI Whisper API
    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const result = await response.json();
    const transcription = result.text || '';
    
    console.log('Transcription successful');

    return new Response(
      JSON.stringify({ text: transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in speech-to-text function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
