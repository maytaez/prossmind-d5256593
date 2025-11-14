import { supabase } from "@prossmind/shared/config";

export async function loadJobResult(jobId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vision_bpmn_jobs')
    .select('bpmn_xml')
    .eq('id', jobId)
    .single();

  if (error || !data?.bpmn_xml) {
    console.error('Failed to load job result:', error);
    return null;
  }

  return data.bpmn_xml;
}
