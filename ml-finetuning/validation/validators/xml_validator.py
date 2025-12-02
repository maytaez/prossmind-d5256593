"""
XML validation script for BPMN 2.0 outputs.
Validates XML against schema and canonicalizes output.
"""

import sys
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple
from xml.parsers.expat import ExpatError
import re
from pathlib import Path


class BPMNXMLValidator:
    """Validates BPMN 2.0 XML against schema and structure requirements."""
    
    REQUIRED_NAMESPACES = {
        'bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
        'bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
        'dc': 'http://www.omg.org/spec/DD/20100524/DC',
        'di': 'http://www.omg.org/spec/DD/20100524/DI'
    }
    
    REQUIRED_ELEMENTS = ['definitions', 'process', 'startEvent', 'endEvent']
    
    INVALID_ELEMENTS = ['flowNodeRef', 'bpmns:', 'BPMN:']
    
    def __init__(self, xsd_schema_path: Optional[str] = None):
        """
        Initialize validator.
        
        Args:
            xsd_schema_path: Path to BPMN 2.0 XSD schema file (optional)
        """
        self.xsd_schema_path = xsd_schema_path
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate(self, xml_string: str) -> Tuple[bool, List[str], List[str]]:
        """
        Validate XML string.
        
        Args:
            xml_string: XML string to validate
            
        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        self.errors = []
        self.warnings = []
        
        # Basic well-formedness check
        if not self._check_well_formed(xml_string):
            return False, self.errors, self.warnings
        
        # Parse XML
        try:
            root = ET.fromstring(xml_string)
        except ET.ParseError as e:
            self.errors.append(f"XML parse error: {str(e)}")
            return False, self.errors, self.warnings
        
        # Check required elements
        self._check_required_elements(root, xml_string)
        
        # Check namespaces
        self._check_namespaces(root, xml_string)
        
        # Check invalid elements
        self._check_invalid_elements(xml_string)
        
        # Check attributes
        self._check_attributes(root)
        
        # Check self-closing tags
        self._check_self_closing_tags(xml_string)
        
        # XSD validation (if schema provided)
        if self.xsd_schema_path:
            self._validate_against_xsd(xml_string)
        
        is_valid = len(self.errors) == 0
        return is_valid, self.errors, self.warnings
    
    def _check_well_formed(self, xml_string: str) -> bool:
        """Check if XML is well-formed."""
        try:
            ET.fromstring(xml_string)
            return True
        except (ET.ParseError, ExpatError) as e:
            self.errors.append(f"Malformed XML: {str(e)}")
            return False
    
    def _check_required_elements(self, root: ET.Element, xml_string: str):
        """Check for required BPMN elements."""
        xml_lower = xml_string.lower()
        
        # Check for definitions element
        if not (xml_lower.count('<bpmn:definitions') > 0 or 
                xml_lower.count('<definitions') > 0):
            self.errors.append("Missing required element: definitions")
        
        # Check for process element
        if not (xml_lower.count('<bpmn:process') > 0 or 
                xml_lower.count('<process') > 0):
            self.errors.append("Missing required element: process")
        
        # Check for startEvent
        if not (xml_lower.count('<bpmn:startevent') > 0 or 
                xml_lower.count('<startevent') > 0):
            self.errors.append("Missing required element: startEvent")
        
        # Check for endEvent
        if not (xml_lower.count('<bpmn:endevent') > 0 or 
                xml_lower.count('<endevent') > 0):
            self.errors.append("Missing required element: endEvent")
    
    def _check_namespaces(self, root: ET.Element, xml_string: str):
        """Check namespace prefixes are correct."""
        # Check for invalid namespace prefixes
        if re.search(r'<bpmns:', xml_string, re.IGNORECASE):
            self.errors.append("Invalid namespace prefix: bpmns: (should be bpmn:)")
        
        if re.search(r'<BPMN:', xml_string, re.IGNORECASE):
            self.errors.append("Invalid namespace prefix: BPMN: (should be bpmn:)")
        
        # Check for required namespaces in root element
        if root.tag.startswith('{'):
            # Extract namespace from tag
            namespace = root.tag[1:].split('}')[0]
            # This is a basic check - full namespace validation would require XSD
        else:
            # Check if definitions element has proper namespace declaration
            if 'xmlns:bpmn' not in xml_string and 'xmlns=' not in xml_string:
                self.warnings.append("Missing namespace declaration")
    
    def _check_invalid_elements(self, xml_string: str):
        """Check for invalid BPMN elements."""
        for invalid in self.INVALID_ELEMENTS:
            if invalid.lower() in xml_string.lower():
                self.errors.append(f"Invalid element found: {invalid}")
    
    def _check_attributes(self, root: ET.Element):
        """Check required attributes are present."""
        # Check sequenceFlow elements have sourceRef and targetRef
        xml_string = ET.tostring(root, encoding='unicode')
        sequence_flows = re.findall(r'<[^>]*sequenceflow[^>]*>', xml_string, re.IGNORECASE)
        
        for flow in sequence_flows:
            if 'sourceref' not in flow.lower():
                self.errors.append("sequenceFlow missing required attribute: sourceRef")
            if 'targetref' not in flow.lower():
                self.errors.append("sequenceFlow missing required attribute: targetRef")
    
    def _check_self_closing_tags(self, xml_string: str):
        """Check di:waypoint tags are self-closing."""
        # Find all di:waypoint tags that are not self-closing
        pattern = r'<di:waypoint[^>]*>(?!\s*</di:waypoint>)'
        matches = re.findall(pattern, xml_string, re.IGNORECASE)
        if matches:
            self.errors.append("di:waypoint tags must be self-closing: <di:waypoint x=\"...\" y=\"...\"/>")
    
    def _validate_against_xsd(self, xml_string: str):
        """Validate against XSD schema if available."""
        try:
            import lxml.etree as lxml_etree
            from lxml import etree
            
            schema_doc = etree.parse(self.xsd_schema_path)
            schema = etree.XMLSchema(schema_doc)
            xml_doc = etree.fromstring(xml_string.encode('utf-8'))
            
            if not schema.validate(xml_doc):
                for error in schema.error_log:
                    self.errors.append(f"XSD validation error: {error.message}")
        except ImportError:
            self.warnings.append("lxml not available, skipping XSD validation")
        except Exception as e:
            self.warnings.append(f"XSD validation failed: {str(e)}")


def canonicalize_xml(xml_string: str) -> str:
    """
    Canonicalize XML for consistent comparison.
    
    Normalizes:
    - Namespace prefixes (bpmns: -> bpmn:)
    - Attribute ordering (alphabetical)
    - Whitespace (2-space indent)
    - Self-closing tags
    """
    # Fix namespace issues
    canonical = xml_string.replace('bpmns:', 'bpmn:')
    canonical = canonical.replace('BPMN:', 'bpmn:')
    
    # Parse and re-serialize to normalize structure
    try:
        root = ET.fromstring(canonical)
        # Sort attributes alphabetically
        def sort_attrs(elem):
            if elem.attrib:
                # Sort attributes
                sorted_attrs = sorted(elem.attrib.items())
                elem.attrib.clear()
                elem.attrib.update(sorted_attrs)
            for child in elem:
                sort_attrs(child)
        
        sort_attrs(root)
        
        # Serialize with consistent formatting
        ET.indent(root, space='  ')
        canonical = ET.tostring(root, encoding='unicode', xml_declaration=True)
        
        # Fix self-closing tags for di:waypoint
        canonical = re.sub(
            r'<di:waypoint([^>]*?)>\s*</di:waypoint>',
            r'<di:waypoint\1/>',
            canonical,
            flags=re.IGNORECASE
        )
        
        # Ensure XML declaration
        if not canonical.strip().startswith('<?xml'):
            canonical = '<?xml version="1.0" encoding="UTF-8"?>\n' + canonical
        
        return canonical
    except ET.ParseError:
        # If parsing fails, return with basic fixes
        return canonical


def validate_model_output(xml_output: str, xsd_schema_path: Optional[str] = None) -> Dict:
    """
    Validate a model output against XML schema and return results.
    
    Args:
        xml_output: XML string from model
        xsd_schema_path: Optional path to XSD schema
        
    Returns:
        Dictionary with validation results
    """
    validator = BPMNXMLValidator(xsd_schema_path)
    is_valid, errors, warnings = validator.validate(xml_output)
    
    canonical = canonicalize_xml(xml_output) if is_valid else None
    
    return {
        'valid': is_valid,
        'errors': errors,
        'warnings': warnings,
        'canonical_xml': canonical,
        'error_count': len(errors),
        'warning_count': len(warnings)
    }


if __name__ == '__main__':
    """CLI interface for validation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate BPMN XML output')
    parser.add_argument('--input', type=str, required=True, help='Input XML file or string')
    parser.add_argument('--xsd', type=str, help='Path to XSD schema file')
    parser.add_argument('--canonicalize', action='store_true', help='Output canonicalized XML')
    
    args = parser.parse_args()
    
    # Read input
    if Path(args.input).exists():
        with open(args.input, 'r', encoding='utf-8') as f:
            xml_content = f.read()
    else:
        xml_content = args.input
    
    # Validate
    result = validate_model_output(xml_content, args.xsd)
    
    # Output results
    print(f"Valid: {result['valid']}")
    print(f"Errors: {result['error_count']}")
    print(f"Warnings: {result['warning_count']}")
    
    if result['errors']:
        print("\nErrors:")
        for error in result['errors']:
            print(f"  - {error}")
    
    if result['warnings']:
        print("\nWarnings:")
        for warning in result['warnings']:
            print(f"  - {warning}")
    
    if args.canonicalize and result['canonical_xml']:
        print("\nCanonical XML:")
        print(result['canonical_xml'])

