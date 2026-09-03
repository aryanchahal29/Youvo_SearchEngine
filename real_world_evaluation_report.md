# Real-World Evaluation Report
  
## Execution Summary
- **Dataset Size**: 75 queries
- **Execution Period**: 2026-08-14T19:01:09.814Z
- **Query Categories**: video, business, marketing, developer, image, finance, productivity, 3d, audio, automation, unknown, social

## Reliability Statistics
- **Total Queries**: 75
- **Successful**: 0 (0.0%)
- **Partial Success**: 20 (26.7%)
- **Failed**: 55 (73.3%)
- **Provider Failures**: 0
- **Tavily Fallbacks**: 95

## Performance Statistics
- **TTFU Status**: 20 measured, 55 not available.
- **TTFU p50**: 1896 ms
- **TTFU p95**: 3936 ms
- **TTFU p99**: 5285 ms
- **Final Latency p50**: 521 ms
- **Final Latency p95**: 9449 ms
- **Final Latency p99**: 14563 ms

*(Note: TTFU distinguishes the time to the first usable candidate from the Final Result Latency.)*

## Quality Statistics (Pending Human Review)
*All human review fields are currently marked `pending_human_review`.*

- Top-1 relevance: Pending
- Top-3 relevance: Pending
- False-positive rate: Pending
- Hard-constraint satisfaction: Pending
- Verification accuracy: Pending

## Warnings & Recommended Fixes
⚠️ **WARNING**: Final latency p95 exceeds 8s provisional target.
⚠️ **WARNING**: High failure rate detected (>10%).

## Final Beta-Readiness Assessment
This report covers automated extraction from the existing frozen production pipeline. A final human review of the generated CSV is required to grade relevance, constraint satisfaction, and ranking accuracy.
