"""
Compute evaluation metrics for fine-tuned model.
Metrics: Schema validation rate, exact match rate, tree edit distance, element-level precision/recall.
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Tuple
import argparse

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))
from validation.validators.xml_validator import validate_model_output, canonicalize_xml


def compute_schema_validation_rate(
    outputs: List[str],
    xsd_schema_path: str = None
) -> Tuple[float, int, int]:
    """
    Compute XML schema validation rate.
    
    Args:
        outputs: List of XML output strings
        xsd_schema_path: Optional path to XSD schema
        
    Returns:
        Tuple of (validation_rate, valid_count, total_count)
    """
    valid_count = 0
    total_count = len(outputs)
    
    for xml in outputs:
        result = validate_model_output(xml, xsd_schema_path)
        if result['valid']:
            valid_count += 1
    
    rate = valid_count / total_count if total_count > 0 else 0.0
    return rate, valid_count, total_count


def compute_exact_match_rate(
    predictions: List[str],
    ground_truths: List[str]
) -> Tuple[float, int, int]:
    """
    Compute exact match rate after canonicalization.
    
    Args:
        predictions: List of predicted XML strings
        ground_truths: List of ground truth XML strings
        
    Returns:
        Tuple of (match_rate, match_count, total_count)
    """
    if len(predictions) != len(ground_truths):
        raise ValueError("Predictions and ground truths must have same length")
    
    matches = 0
    total = len(predictions)
    
    for pred, gt in zip(predictions, ground_truths):
        try:
            pred_canonical = canonicalize_xml(pred)
            gt_canonical = canonicalize_xml(gt)
            if pred_canonical == gt_canonical:
                matches += 1
        except Exception as e:
            print(f"Warning: Failed to canonicalize: {e}")
            continue
    
    rate = matches / total if total > 0 else 0.0
    return rate, matches, total


def compute_element_metrics(
    pred_xml: str,
    gt_xml: str
) -> Dict[str, float]:
    """
    Compute element-level precision, recall, and F1.
    
    Args:
        pred_xml: Predicted XML string
        gt_xml: Ground truth XML string
        
    Returns:
        Dictionary with precision, recall, f1 scores
    """
    import xml.etree.ElementTree as ET
    import re
    
    def extract_elements(xml_string: str) -> set:
        """Extract set of (tag, id, attributes) tuples."""
        try:
            root = ET.fromstring(xml_string)
            elements = set()
            
            def traverse(elem, parent_tag=''):
                tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                elem_id = elem.get('id', '')
                
                # Create signature: (tag, id, sorted_attrs)
                attrs = tuple(sorted(elem.attrib.items()))
                elements.add((tag, elem_id, attrs))
                
                for child in elem:
                    traverse(child, tag)
            
            traverse(root)
            return elements
        except Exception:
            return set()
    
    pred_elements = extract_elements(pred_xml)
    gt_elements = extract_elements(gt_xml)
    
    intersection = pred_elements & gt_elements
    
    precision = len(intersection) / len(pred_elements) if pred_elements else 0.0
    recall = len(intersection) / len(gt_elements) if gt_elements else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    
    return {
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'predicted_elements': len(pred_elements),
        'ground_truth_elements': len(gt_elements),
        'matched_elements': len(intersection)
    }


def compute_tree_edit_distance(
    pred_xml: str,
    gt_xml: str
) -> float:
    """
    Compute tree edit distance using Zhang-Shasha algorithm.
    
    Args:
        pred_xml: Predicted XML string
        gt_xml: Ground truth XML string
        
    Returns:
        Normalized tree edit distance (0-1 scale)
    """
    try:
        import zss
        import xml.etree.ElementTree as ET
        
        def xml_to_tree(xml_string: str):
            """Convert XML to zss.Node tree."""
            try:
                root = ET.fromstring(xml_string)
                
                def build_tree(elem, parent=None):
                    tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                    node = zss.Node(tag)
                    
                    for child in elem:
                        child_node = build_tree(child, node)
                        node.addkid(child_node)
                    
                    return node
                
                return build_tree(root)
            except Exception:
                return zss.Node('root')
        
        pred_tree = xml_to_tree(pred_xml)
        gt_tree = xml_to_tree(gt_xml)
        
        distance = zss.simple_distance(pred_tree, gt_tree)
        
        # Normalize by max tree size
        max_size = max(
            len(list(pred_tree.iter())),
            len(list(gt_tree.iter()))
        )
        
        normalized = distance / max_size if max_size > 0 else 1.0
        return normalized
    except ImportError:
        print("Warning: zss library not installed. Install with: pip install zss")
        return 0.0
    except Exception as e:
        print(f"Warning: Tree edit distance computation failed: {e}")
        return 0.0


def compute_all_metrics(
    predictions: List[str],
    ground_truths: List[str],
    xsd_schema_path: str = None
) -> Dict:
    """
    Compute all evaluation metrics.
    
    Args:
        predictions: List of predicted XML strings
        ground_truths: List of ground truth XML strings
        xsd_schema_path: Optional path to XSD schema
        
    Returns:
        Dictionary with all metrics
    """
    metrics = {}
    
    # Schema validation rate
    schema_rate, valid_count, total_count = compute_schema_validation_rate(
        predictions, xsd_schema_path
    )
    metrics['schema_validation_rate'] = schema_rate
    metrics['schema_valid_count'] = valid_count
    metrics['schema_total_count'] = total_count
    metrics['schema_violation_rate'] = 1.0 - schema_rate
    
    # Exact match rate
    exact_rate, match_count, _ = compute_exact_match_rate(predictions, ground_truths)
    metrics['exact_match_rate'] = exact_rate
    metrics['exact_match_count'] = match_count
    
    # Element-level metrics (average across all examples)
    element_precisions = []
    element_recalls = []
    element_f1s = []
    
    for pred, gt in zip(predictions, ground_truths):
        elem_metrics = compute_element_metrics(pred, gt)
        element_precisions.append(elem_metrics['precision'])
        element_recalls.append(elem_metrics['recall'])
        element_f1s.append(elem_metrics['f1'])
    
    metrics['element_precision'] = sum(element_precisions) / len(element_precisions) if element_precisions else 0.0
    metrics['element_recall'] = sum(element_recalls) / len(element_recalls) if element_recalls else 0.0
    metrics['element_f1'] = sum(element_f1s) / len(element_f1s) if element_f1s else 0.0
    
    # Tree edit distance (average)
    tree_distances = []
    for pred, gt in zip(predictions, ground_truths):
        distance = compute_tree_edit_distance(pred, gt)
        tree_distances.append(distance)
    
    metrics['avg_tree_edit_distance'] = sum(tree_distances) / len(tree_distances) if tree_distances else 0.0
    
    return metrics


def load_jsonl(file_path: str) -> List[Dict]:
    """Load JSONL file."""
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute evaluation metrics')
    parser.add_argument('--predictions', type=str, required=True,
                       help='JSONL file with predictions (must have "output" field)')
    parser.add_argument('--ground-truths', type=str, required=True,
                       help='JSONL file with ground truths (must have "output" field)')
    parser.add_argument('--xsd', type=str, help='Path to XSD schema file')
    parser.add_argument('--output', type=str, help='Output JSON file for metrics')
    
    args = parser.parse_args()
    
    # Load data
    print("Loading predictions...")
    pred_records = load_jsonl(args.predictions)
    predictions = [r['output'] for r in pred_records]
    
    print("Loading ground truths...")
    gt_records = load_jsonl(args.ground_truths)
    ground_truths = [r['output'] for r in gt_records]
    
    if len(predictions) != len(ground_truths):
        print(f"Warning: Mismatch in lengths: {len(predictions)} predictions vs {len(ground_truths)} ground truths")
        min_len = min(len(predictions), len(ground_truths))
        predictions = predictions[:min_len]
        ground_truths = ground_truths[:min_len]
    
    # Compute metrics
    print("Computing metrics...")
    metrics = compute_all_metrics(predictions, ground_truths, args.xsd)
    
    # Print results
    print("\n" + "="*50)
    print("EVALUATION METRICS")
    print("="*50)
    print(f"Schema Validation Rate: {metrics['schema_validation_rate']:.2%}")
    print(f"Schema Violation Rate: {metrics['schema_violation_rate']:.2%}")
    print(f"Exact Match Rate: {metrics['exact_match_rate']:.2%}")
    print(f"Element Precision: {metrics['element_precision']:.2%}")
    print(f"Element Recall: {metrics['element_recall']:.2%}")
    print(f"Element F1: {metrics['element_f1']:.2%}")
    print(f"Avg Tree Edit Distance: {metrics['avg_tree_edit_distance']:.4f}")
    print("="*50)
    
    # Save to file if requested
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2)
        print(f"\nMetrics saved to {args.output}")

