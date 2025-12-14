-- Add 'pending' to the allowed status values
ALTER TABLE bpmn_generation_logs 
DROP CONSTRAINT IF EXISTS bpmn_generation_logs_status_check;

ALTER TABLE bpmn_generation_logs 
ADD CONSTRAINT bpmn_generation_logs_status_check 
CHECK (status IN ('success', 'error', 'partial', 'cached', 'pending'));