# Blueprint Extraction System Prompt

This prompt is used in the blueprint update workflow. It extracts patterns from approved specs and updates the living project blueprint, enabling compounding knowledge over time.

## System Prompt

```
You maintain a living technical blueprint for a ServiceNow application. You are given a recently approved technical specification and will extract the patterns, components, and architecture decisions from it to update the project's blueprint document.

INPUT:
1. CURRENT_BLUEPRINT: The existing blueprint knowledge article (may be empty if this is the first spec)
2. APPROVED_SPEC: The newly completed and approved technical specification
3. STORY_NUMBER: The story identifier (for tracking what introduced this change)

RULES:
- Only add items that are now confirmed to exist. If the approved spec was implemented by the developer, those components are now real.
- If this spec modifies or replaces something already in the blueprint, update that entry (don't duplicate).
- Do not editorialize or add anything not directly evidenced by the spec.
- Keep entries terse — one line per item, not paragraphs. The blueprint is retrieved as context for future specs, so conciseness matters for token usage.
- If the spec reveals a pattern that contradicts an existing "Naming Conventions in Use" entry, update that entry to match reality.
- Preserve the structured format exactly (markdown headers, bullet points, one-line descriptions).
- Do not add speculative future work or known gaps unless they are explicitly mentioned in the approved spec.

BLUEPRINT STRUCTURE:
Your output will be structured as follows (preserve this format):

# [Project/App Name] Blueprint

## Tables & Fields
- (table name) — purpose, key fields, extended from what base table

## Integrations
- (integration name) — direction, method (REST/SOAP/MID Server), auth pattern

## Business Rules / Flows / Script Includes
- (name) — trigger condition, purpose, table

## Naming Conventions in Use
- (pattern) — example, where it applies

## Known Gaps / Deferred Items
- (item) — why deferred, what it blocks

## Last Updated
- (story number) — (date)

OUTPUT:
Return the complete, updated blueprint document ready to overwrite the knowledge article. Include all previous content plus any new additions/updates from this spec. Do not abbreviate or summarize — return the full blueprint.

EDGE CASES:
- If this is the first spec for a project, bootstrap the blueprint with all components from this spec.
- If a component was marked as "deferred" in a previous spec and is now implemented, move it from "Known Gaps" to the appropriate section and remove from gaps.
- If the spec introduces a new naming pattern not seen before, add it to "Naming Conventions in Use".
- If the spec mentions a future blocker or dependency, add it to "Known Gaps / Deferred Items" only if not already there.
```

## User Message Template

```
CURRENT_BLUEPRINT:
{{existing_blueprint_text}}

APPROVED_SPEC (Story {{story_number}}):
{{approved_technical_specification}}

CURRENT_DATE:
{{current_date}}
```

## Implementation Notes

### 1. Trigger Condition

The blueprint update should only run when:
- `technical_specification` is not empty (spec was generated and written)
- `state` changes to `Closed` or `Complete` (developer confirmed implementation)
- Optionally: only if minimal edits were made to the spec (strong signal of accuracy)

### 2. Context Extraction

When you build the prompt in n8n:
- **Current blueprint**: Query the knowledge article for this project (retrieve by sys_id from story.project field)
- **Approved spec**: Pass the full `technical_specification` field value from the story
- **Story number**: Include for audit trail (helps track which story introduced which component)

### 3. Response Handling

Claude will return the complete updated blueprint. In n8n:
1. Extract the response text
2. Update the knowledge article directly with new content
3. Update "Last Updated" to include story number and today's date
4. ServiceNow will maintain version history

### 4. Token Efficiency

- **Typical blueprint growth**: 300-500 tokens per story (as components accumulate)
- **Max blueprint size**: For active projects, ~3000-5000 tokens (only pass relevant sections to main spec generation if it grows large)
- **Archival strategy**: If blueprint exceeds 5000 tokens, consider splitting by functional area or archiving old sections

### 5. Failure Scenarios

**If blueprint extraction fails:**
- Blueprint update is non-critical (spec was already written)
- Log the error but don't block story closure
- Manual review can update blueprint monthly instead
- Alternatively, retry with smaller context (extract only from "Affected Components" section of spec)

**If spec didn't clearly state all components:**
- Claude might mark something as uncertain in extracted entry
- Reviewers can clean up during monthly governance review
- Better to have incomplete blueprint than fabricated components

## Example Extraction

### Input
**Current Blueprint:**
```markdown
# Incident Management Enhancement Blueprint

## Tables & Fields
- incident — extended for custom priority field

## Integrations
None yet

## Business Rules / Flows / Script Includes
- INC - Auto-priority — after insert, sets priority based on impact

## Naming Conventions in Use
- Business Rule names start with INC - for incident table

## Known Gaps / Deferred Items
- Approval workflow deferred (waiting for CSM licensing decision)

## Last Updated
- STORY-010 — 2024-06-15
```

**Approved Spec (STORY-025):**
```markdown
## Summary
Implement approval workflow for high-impact changes.

## Affected Components
- Flows: INC - Impact Approval
- Business Rules: INC - Auto-Escalate High Impact
- Integrations: None

## Detailed Changes
- **Flow**: "INC - Impact Approval", Trigger: fired by Business Rule, creates approval task
- **Business Rule**: "INC - Auto-Escalate High Impact", Table: incident, Trigger: after update, Condition: impact > threshold
...
```

### Output
```markdown
# Incident Management Enhancement Blueprint

## Tables & Fields
- incident — extended for custom priority field and impact assessment

## Integrations
None yet

## Business Rules / Flows / Script Includes
- INC - Auto-priority — after insert, sets priority based on impact
- INC - Auto-Escalate High Impact — after update, fires approval workflow if impact exceeds threshold
- INC - Impact Approval — approval workflow triggered by auto-escalate rule

## Naming Conventions in Use
- Business Rule names start with INC - for incident table
- Flow names: INC - [Action Description]

## Known Gaps / Deferred Items
None currently

## Last Updated
- STORY-025 — 2024-07-27
```

(Note: Approval workflow was deferred before but is now implemented, so it moved out of "Known Gaps")

## Governance & Review

### Monthly Blueprint Review

Someone (architect, tech lead) should spend ~30-60 minutes per month reviewing blueprints for:

1. **Drift Detection**: Has something changed that contradicts the blueprint?
   - New pattern not captured in "Naming Conventions"
   - Component deprecated or replaced
   - One-off exception incorrectly generalized

2. **Accuracy**: Did extraction capture all components?
   - Cross-reference approved specs from the month
   - Check for missing tables, fields, integrations

3. **Clarity**: Are entries clear and actionable for future readers?
   - Remove vague entries
   - Add clarification if someone would be confused

4. **Cleanup**: Remove or consolidate redundant entries
   - "INC - Priority Calculation" vs "INC - Auto-priority" (are these the same?)

This review is not a rewrite — if extraction rules above are followed, the blueprint should be 95% accurate and require only minor fixes.

### When to Archive/Split

If a blueprint grows beyond 5000 tokens:
- Consider splitting by functional area (if a large project with many sub-systems)
- Or archive completed phases into separate articles
- Link from main blueprint: "For incident routing architecture (completed 2024), see [Incident Routing v1 Blueprint]"

## Version History

- **v1.0** (2024-07): Initial blueprint extraction prompt design
- Adjust based on first 20-30 extracted blueprints to find extraction patterns that need refinement
