"""
Extract production logs for fine-tuning dataset.
Collects prompts and BPMN XML outputs from production functions.
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import re


def extract_pii(text: str) -> tuple[str, List[str]]:
    """
    Detect and redact PII from text.
    
    Returns:
        Tuple of (redacted_text, detected_pii_types)
    """
    redacted = text
    detected = []
    
    # Email pattern
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    if re.search(email_pattern, redacted):
        redacted = re.sub(email_pattern, '[EMAIL]', redacted)
        detected.append('email')
    
    # Phone pattern (US format)
    phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
    if re.search(phone_pattern, redacted):
        redacted = re.sub(phone_pattern, '[PHONE]', redacted)
        detected.append('phone')
    
    # SSN pattern
    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    if re.search(ssn_pattern, redacted):
        redacted = re.sub(ssn_pattern, '[SSN]', redacted)
        detected.append('ssn')
    
    # Credit card pattern (basic)
    cc_pattern = r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'
    if re.search(cc_pattern, redacted):
        redacted = re.sub(cc_pattern, '[CARD]', redacted)
        detected.append('credit_card')
    
    return redacted, detected


def extract_from_supabase_cache(
    supabase_url: str,
    supabase_key: str,
    table_name: str = 'bpmn_cache',
    limit: Optional[int] = None
) -> List[Dict]:
    """
    Extract data from Supabase bpmn_cache table.
    
    Args:
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key
        table_name: Table name to query
        limit: Maximum number of records to extract
        
    Returns:
        List of extracted records
    """
    try:
        from supabase import create_client, Client
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        query = supabase.table(table_name).select('*').eq('status', 'completed')
        
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        return response.data if response.data else []
    except ImportError:
        print("Warning: supabase-py not installed. Install with: pip install supabase")
        return []
    except Exception as e:
        print(f"Error extracting from Supabase: {e}")
        return []


def process_record(record: Dict, diagram_type: str = 'bpmn') -> Optional[Dict]:
    """
    Process a single record into training format.
    
    Args:
        record: Raw record from database
        diagram_type: 'bpmn' or 'pid'
        
    Returns:
        Processed record or None if invalid
    """
    # Extract prompt
    prompt = record.get('prompt') or record.get('user_prompt') or ''
    if not prompt:
        return None
    
    # Extract BPMN XML
    bpmn_xml = record.get('bpmn_xml') or record.get('bpmnXml') or ''
    if not bpmn_xml:
        return None
    
    # Redact PII
    redacted_prompt, pii_types = extract_pii(prompt)
    
    # Build system prompt
    if diagram_type == 'pid':
        system_prompt = """You are a P&ID expert. Generate BPMN 2.0 XML with P&ID attributes for process diagrams.

CRITICAL RULES:
1. EVERY element MUST have pid:type, pid:symbol, pid:category attributes
2. Equipment (task): pid:type="equipment", pid:symbol="tank|pump|filter|heat_exchanger", pid:category="mechanical"
3. Valves (exclusiveGateway): pid:type="valve", pid:symbol="valve_control|valve_check|valve_gate|valve_solenoid", pid:category="mechanical"
4. Return ONLY XML, no markdown."""
    else:
        system_prompt = """You are a BPMN 2.0 XML expert. Generate valid BPMN 2.0 XML based on user descriptions.

CRITICAL RULES:
1. Return ONLY valid BPMN 2.0 XML format
2. Use namespace: xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
3. Use elements: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, endEvent
4. Include sequenceFlow with sourceRef and targetRef
5. Add bpmndi:BPMNDiagram section for visual layout
6. ALL di:waypoint tags MUST be self-closing: <di:waypoint x="..." y="..."/>
7. Return ONLY XML, no markdown or explanations"""
    
    # Build input (system + user prompt)
    input_text = f"System: {system_prompt}\n\nUser: {redacted_prompt}"
    
    # Extract metadata
    metadata = {
        'diagram_type': diagram_type,
        'complexity_score': record.get('complexity_score', 3),
        'timestamp': record.get('created_at') or record.get('timestamp'),
        'pii_detected': pii_types,
        'model_used': record.get('model_used', 'unknown')
    }
    
    return {
        'input': input_text,
        'output': bpmn_xml,
        'metadata': metadata
    }


def extract_production_logs(
    output_path: str,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    limit: Optional[int] = None,
    diagram_type: str = 'bpmn'
) -> int:
    """
    Extract production logs and save to JSONL format.
    
    Args:
        output_path: Path to output JSONL file
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key
        limit: Maximum records to extract
        diagram_type: 'bpmn' or 'pid'
        
    Returns:
        Number of records extracted
    """
    records = []
    
    # Extract from Supabase if credentials provided
    if supabase_url and supabase_key:
        print(f"Extracting from Supabase table 'bpmn_cache'...")
        db_records = extract_from_supabase_cache(supabase_url, supabase_key, limit=limit)
        print(f"Found {len(db_records)} records in database")
        
        for record in db_records:
            processed = process_record(record, diagram_type)
            if processed:
                records.append(processed)
    else:
        print("Warning: No Supabase credentials provided. Skipping database extraction.")
        print("To extract from database, provide SUPABASE_URL and SUPABASE_KEY environment variables.")
    
    # Save to JSONL
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    
    print(f"Extracted {len(records)} records to {output_path}")
    return len(records)


if __name__ == '__main__':
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='Extract production logs for fine-tuning')
    parser.add_argument('--output', type=str, default='data/processed/production_logs.jsonl',
                       help='Output JSONL file path')
    parser.add_argument('--limit', type=int, help='Maximum records to extract')
    parser.add_argument('--diagram-type', type=str, default='bpmn', choices=['bpmn', 'pid'],
                       help='Diagram type to extract')
    parser.add_argument('--supabase-url', type=str, default=None,
                       help='Supabase URL (or set SUPABASE_URL env var)')
    parser.add_argument('--supabase-key', type=str, default=None,
                       help='Supabase key (or set SUPABASE_KEY env var)')
    
    args = parser.parse_args()
    
    # Get credentials from args or environment
    supabase_url = args.supabase_url or os.getenv('SUPABASE_URL')
    supabase_key = args.supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    count = extract_production_logs(
        args.output,
        supabase_url,
        supabase_key,
        args.limit,
        args.diagram_type
    )
    
    print(f"\nExtraction complete: {count} records")

