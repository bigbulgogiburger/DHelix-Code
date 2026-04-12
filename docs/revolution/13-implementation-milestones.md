# Implementation Milestones

## Milestone A. Runtime Foundation

Exit criteria:

- runtime stages are explicit
- compaction and timing metrics exist
- tool scheduling is extracted into a dedicated seam

Primary risk:

- accidental regressions in tool execution order

## Milestone B. Durable Work

Exit criteria:

- background jobs have durable records
- team state can be resumed and inspected
- shell tasks support attach/cancel with stable IDs

Primary risk:

- persistence model grows faster than UI support

## Milestone C. Operator Surfaces

Exit criteria:

- CLI exposes jobs, approvals, artifacts, and runtime health
- diff/review experience is materially stronger
- editor integration can show meaningful work state

Primary risk:

- overbuilding UI before runtime contracts settle

## Milestone D. Typed Extensibility

Exit criteria:

- skills and agents have typed manifests
- trust tiers are enforced
- extensibility provenance is inspectable

Primary risk:

- backwards compatibility with existing markdown-based capabilities

## Milestone E. Policy and Ops Maturity

Exit criteria:

- permission provenance exists
- MCP and hook anomalies are easy to inspect
- audit surfaces support real troubleshooting

Primary risk:

- telemetry is added without enough product-facing explanation
