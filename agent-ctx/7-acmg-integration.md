# Task ID: 7 - ACMG Classification Engine Integration into Chat System

## Work Task
Integrate the ACMG classification engine into the chat system so variant interpretation queries call real bioinformatics APIs and run the ACMG classifier.

## Work Summary

### Files Created
1. `src/lib/variant-parser.ts` — Variant format parsing utility (VCF, rsID, HGVS detection)

### Files Modified
2. `src/app/api/chat/route.ts` — Major upgrade: variant_interpretation case now runs full ACMG pipeline
3. `src/lib/llm-service.ts` — Enhanced variant_interpretation system prompt for multi-source data

### Key Implementation Details

- **Variant parser**: Supports VCF colon (`chr17:43045678:G:A`), VCF arrow (`17:43045678G>A`), rsID (`rs80357713`), and HGVS (`c.5266dupC`) formats. Falls back to scanning user message for extractable coordinates.
- **ACMG Pipeline**: VEP → ClinVar + gnomAD (parallel) → ACMG classifier → comprehensive context → LLM
- **Graceful fallback**: All API calls wrapped with try/catch; failures fall through to knowledge-base-only mode
- **Metadata**: Full classification result structure (gene, variant, hgvsC, hgvsP, acmgClassification, clinvarSignificance, gnomadFrequency, appliedRules, evidenceSummary)
- **LLM prompt**: Instructs to reference real data, explain each ACMG rule, and indicate data gaps

### Quality
- ESLint: 0 errors, 0 warnings
- Dev server: Compiles successfully
