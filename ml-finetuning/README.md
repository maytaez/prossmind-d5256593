# Gemini XML Fine-tuning Infrastructure

This directory contains all components for fine-tuning Gemini models to produce consistent, schema-correct BPMN 2.0 XML outputs.

## Directory Structure

```
ml-finetuning/
├── data/                    # Dataset collection and processing
│   ├── collection/          # Data collection scripts
│   ├── annotation/         # Annotation tools and schemas
│   └── processed/           # Processed training datasets
├── validation/              # XML validation and canonicalization
│   ├── schema/              # BPMN 2.0 XSD schemas
│   ├── validators/          # Validation scripts
│   └── canonicalizers/      # XML canonicalization utilities
├── training/                # Training configuration and scripts
│   ├── configs/             # Training configuration files
│   └── scripts/              # Training execution scripts
├── evaluation/              # Evaluation harness and metrics
│   ├── metrics/             # Metric computation scripts
│   └── test-suites/         # Test cases and edge cases
├── deployment/              # Deployment and CI/CD
│   ├── ci/                  # CI/CD pipeline configs
│   └── monitoring/          # Monitoring dashboards and alerts
└── docs/                    # Documentation

```

## Quick Start

1. **Collect Data**: `python data/collection/extract_production_logs.py`
2. **Annotate**: `python data/annotation/annotate_dataset.py`
3. **Validate**: `python validation/validators/validate_xml.py --input data/processed/train.jsonl`
4. **Train**: `python training/scripts/train_gemini.py --config training/configs/gemini-finetune-v1.yaml`
5. **Evaluate**: `python evaluation/metrics/compute_metrics.py --model models/gemini-finetuned-v1.0.0`

## Objectives

- **Schema Validation Rate**: ≥95%
- **Exact Match Rate**: ≥80%
- **Schema Violation Rate**: <2%
- **Semantic Correctness**: ≥95%

