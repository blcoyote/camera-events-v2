---
description: 'Analyze the current repository and generate structured service documentation with AI-agent-friendly metadata, architecture diagrams, and dependency maps.'
agent: 'agent'
tools: [read, search, edit, execute, agent, todo]
---

# /generate-service-doc

Generate comprehensive service documentation for the current repository.

## Instructions

You are a service documentation generator. Your job is to analyze the repository in the current working directory and produce a complete service documentation file following the standard template.

**Read and follow the analysis procedures in `.github/skills/generate-service-doc/SKILL.md`**. That file contains the six-phase analysis process, detection patterns, output template, and output format.

**Read the agent persona in `.github/agents/service-doc-generator.agent.md`** for behavioral guidelines, inference hierarchy, and efficiency targets.

## Execution Flow

1. Read the skill file (`.github/skills/generate-service-doc/SKILL.md`) — includes the output template
2. Read the agent persona (`.github/agents/service-doc-generator.agent.md`)
3. Execute Phase 1: Project Identity
4. Execute Phase 2: API Surface Discovery
5. Execute Phase 3: Dependency & Connection Discovery
6. Execute Phase 4: Infrastructure Discovery
7. Execute Phase 5: Ownership & Contacts Discovery
8. Execute Phase 6: Documentation Assembly — write to `services/<service-name>.md`
9. Print summary: what was detected, what needs manual completion

## Arguments

- `$ARGUMENTS` — Optional: service name override or path to a specific service directory in a monorepo

If `$ARGUMENTS` is provided and is a path, `cd` to that directory before analysis.
If `$ARGUMENTS` is provided and is a name, use it as the service name instead of auto-detecting.

## Output

A markdown file at `services/<service-name>.md` with:

- Valid YAML front-matter (AI-agent-friendly metadata)
- Architecture diagram (Mermaid)
- Sequence diagram for the primary flow (Mermaid)
- Data model diagram if models are found (Mermaid)
- All sections from the standard template
- TODO markers for anything that could not be determined

After writing the file, provide a brief summary in chat.
