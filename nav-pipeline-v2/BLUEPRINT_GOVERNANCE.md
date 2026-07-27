# Blueprint Governance Guide

## Overview

Project blueprints are living documents that grow with each completed story. This guide covers the monthly/quarterly review process to ensure blueprints stay accurate and useful.

## Why Blueprint Governance Matters

As blueprints grow, they accumulate small inaccuracies:
- A one-off exception extracted as if it were standard
- A deprecated component not removed
- A naming convention that changed mid-project
- An integration that got replaced

These errors compound: future specs reference a slightly-wrong blueprint, which leads to newer specs being slightly-wrong, and so on. **Monthly review prevents this drift.**

The review is NOT a rewrite — it's a 30-60 minute spot-check that keeps the compounding benefit pure.

## Monthly Review Process

### Step 1: Select Blueprints to Review (5 mins)

**Cadence**: Monthly or quarterly, your choice

**Scope**: Review 1-3 active projects per cycle:
- Prioritize projects with 5+ completed stories
- Rotate through all active projects over a quarter
- Focus on projects with new developers who will reference the blueprint

### Step 2: Gather Source Data (5 mins)

For each blueprint review:

1. **Open the blueprint article** in ServiceNow
2. **Identify stories since last review**
   - Read "Last Updated" timestamp
   - List all stories closed since that date
3. **Pull approved specs** for those stories
   - Open each story in ServiceNow
   - Copy the `technical_specification` field

### Step 3: Check for Drift (20-30 mins)

Review each section of the blueprint against the approved specs:

#### Tables & Fields Section

Check:
- [ ] Are all tables mentioned in recent specs listed here?
- [ ] Are new custom fields captured?
- [ ] Are deprecated tables removed?

**Example of drift:**
- Blueprint says: `incident — extended for custom priority field`
- But recent spec created a new `incident_category_mapping` table
- **Fix**: Add `incident_category_mapping — maps incident categories to custom priority levels`

#### Integrations Section

Check:
- [ ] Are all REST calls, SOAP calls, MID Server work listed?
- [ ] Are deprecated integrations removed?
- [ ] Are auth patterns accurate (OAuth, basic auth, API key)?

**Example of drift:**
- Blueprint says: `No integrations`
- But STORY-042 created an outbound REST call to Jira
- **Fix**: Add `Jira Sync — outbound REST, OAuth2, triggered on incident update`

#### Business Rules / Flows / Script Includes Section

Check:
- [ ] All new automation listed?
- [ ] Removed or replaced items removed from blueprint?
- [ ] Trigger conditions still accurate?

**Example of drift:**
- Blueprint says: `INC - Auto-priority — after insert, sets priority`
- But STORY-050 changed this: now fires "after insert/update"
- **Fix**: Update to `INC - Auto-priority — after insert/update, sets priority based on impact`

#### Naming Conventions Section

Check:
- [ ] Patterns match actual code?
- [ ] Any new patterns not yet documented?
- [ ] Any patterns that contradict what was actually implemented?

**Example of drift:**
- Blueprint says: `Business Rule names: [TABLE] - [Action]` (e.g., "INC - Auto-Assign")
- But recent specs follow: `[TABLE]_[Action]_[Variant]` (e.g., "INC_Auto_Assign_V2")
- **Fix**: Either update blueprints to new pattern OR note that old pattern is legacy (used pre-2024)

#### Known Gaps / Deferred Items Section

Check:
- [ ] Items marked deferred — were they implemented in recent stories?
- [ ] New gaps mentioned in specs — should they be added?

**Example of drift:**
- Blueprint says: `Approval workflow deferred — waiting for CSM license`
- But STORY-048 implemented it with new license
- **Fix**: Remove from gaps, add to "Business Rules / Flows / Script Includes"

### Step 4: Update Blueprint (10-15 mins)

For each issue found:

1. **Make minimal corrections**
   - Only fix actual errors, don't rewrite for style
   - Keep entries terse
   - Preserve existing structure

2. **Update "Last Updated"** line
   - Change date to today
   - Optional: list which stories were reviewed (e.g., "STORY-042 through STORY-051")

3. **Save in ServiceNow**
   - Update the knowledge article
   - Add comment noting review date if desired

### Step 5: Document Review Results (5 mins)

Keep a simple log (can be a yearly spreadsheet):

| Project | Review Date | Issues Found | Issues Fixed | Notes |
|---------|-------------|--------------|--------------|-------|
| Incident Management | 2024-08-01 | 3 | 3 | Removed deprecated field refs |
| Change Management | 2024-08-15 | 1 | 1 | Updated integration auth method |
| Request Fulfillment | 2024-09-01 | 0 | 0 | No drift detected |

## Common Issues & Fixes

### Issue 1: One-Off Exception Captured as Standard

**Symptom**: Blueprint lists something as a permanent pattern, but it was a one-time workaround.

**Example**: Blueprint says `"Always use table_x for custom fields"`, but STORY-045 notes `"table_x used here, but normally use table_y (CSM not licensed yet)"`

**Fix**: Either update pattern to be accurate for most cases, or add exception note:
- ✗ `Always use table_x for custom fields`
- ✓ `Typically use table_y; table_x used for legacy support in incident module only`

### Issue 2: Deprecated Component Not Removed

**Symptom**: Blueprint lists a Business Rule or Flow that's been superseded.

**Example**: Blueprint lists `"INC - Auto-Assign v1"`, but STORY-049 replaced it with `"INC - Auto-Assign v2 (uses ML model)"`

**Fix**: Remove v1 entirely, replace with v2. If v1 still runs, note context:
- ✗ `INC - Auto-Assign v1 — after insert, assigns based on skill`
- ✓ `INC - Auto-Assign v2 — after insert/update, assigns using ML model (v1 deprecated in STORY-049)`

### Issue 3: Naming Pattern Drift

**Symptom**: Recent specs don't follow the documented naming convention.

**Example**: Blueprint says Business Rules follow `"[TABLE] - [Action]"` but recent specs use `"[TABLE]_[ACTION]_[VARIANT]"`

**Fix**: Investigate why:
1. **Legitimate pattern change**: Document new pattern, note when it changed:
   ```
   - Business Rule names: [TABLE] - [Action] (legacy, pre-2024)
   - Business Rule names: [TABLE]_[ACTION]_[VARIANT] (current, adopted STORY-048+)
   ```

2. **Extraction error**: If extraction picked up an exception as the rule, revert blueprint and add exception:
   ```
   - Standard: [TABLE] - [Action]
   - Exception: incident_routing uses [TABLE]_custom_[name] pattern for compatibility reasons
   ```

3. **Unknown reason**: Flag for team discussion — something changed without documentation

### Issue 4: New Component Type Not Captured

**Symptom**: Specs mention a component type the blueprint doesn't have a section for.

**Example**: Specs start mentioning "UI Actions" but blueprint has no section for them.

**Fix**: Add a new section if it's substantial enough:
```markdown
## UI Actions
- (action name) — trigger, what it does, tables affected
```

Or add to existing section if minor.

### Issue 5: Integration Authentication Changed

**Symptom**: Blueprint lists integration auth as "Basic Auth", but recent spec uses "OAuth2".

**Example**: 
- Blueprint: `ServiceNow Jira Connector — outbound REST, basic auth`
- Spec: `Upgraded to OAuth2 for better security`

**Fix**: Update to reflect current state:
- ✓ `ServiceNow Jira Connector — outbound REST, OAuth2 (upgraded from basic auth in STORY-050)`

## Escalation Path

**If you find something confusing during review**, don't guess — ask:

1. **Pattern change unclear?** → Ask the developer who implemented it
2. **Component seems redundant?** → Check both implementations, or ask architect
3. **Large section needs rewrite?** → Schedule a team discussion, don't rewrite solo

## Blueprint Deprecation

If a blueprint grows beyond 5000 tokens, consider archiving:

1. **Completed phases**: "Incident Routing Phase 1 (STORY-001 through STORY-030)" → Archive as separate article
2. **Keep active blueprint** focused on current systems
3. **Link to archived phases** for historical context

Example:
```markdown
# Incident Management Blueprint

[current active content]

## Archived Sections
- Phase 1 Routing (STORY-001–030): See [Incident Routing Phase 1 Blueprint]
- Legacy Integration (pre-2023): See [Incident Legacy Integration Blueprint]
```

## Tips for Efficient Reviews

1. **Use a template**: Copy-paste section headers and just update values
2. **Spot-check, don't exhaustive review**: Check ~10-15 recent stories, not all 100
3. **Batch reviews**: Do 3 projects in one sitting, not spread across weeks
4. **Set calendar reminder**: "2nd Tuesday of month at 2pm: Blueprint review"
5. **Involve developers**: Have them review their own stories' impact on blueprint

## Integration with Extraction Process

The extraction agent (Claude) is responsible for adding to the blueprint. Your review:
- Catches errors the extraction missed (edge cases, one-offs)
- Confirms extraction is working well
- Identifies if extraction rules need adjustment

**If you find a systematic extraction error** (same mistake across multiple specs):
1. Document the pattern
2. Review the extraction prompt (`prompts/blueprint-extraction.md`)
3. Consider refining the extraction rules (next major update)

## Success Metrics

After 3 months of reviews, you should see:

- ✓ Few inaccuracies per review (< 5)
- ✓ Most updates are minor tweaks, not major rewrites
- ✓ Development team finds blueprint helpful when implementing new specs
- ✓ Time per review stabilizing (~30-60 min)
- ✓ New specs increasingly reference the blueprint accurately

If not hitting these:
- Extraction prompt may need refinement
- Team may need training on what goes in blueprints
- Consider increasing review frequency (monthly → bi-weekly)

## Example Review

**Date**: August 15, 2024  
**Project**: Incident Management  
**Stories Reviewed**: STORY-040 through STORY-048

**Issues Found & Fixed**:
1. ✓ Removed deprecated `incident_severity` field (replaced by `priority`)
2. ✓ Updated integration auth: `Remedy RTC` now uses OAuth2, not API key
3. ✓ Added new Business Rule: `INC - Notify External Systems`
4. ✓ Updated naming convention note: clarified that v2 pattern adopted in STORY-043

**Time Spent**: 42 minutes  
**Blueprint Size**: 3200 tokens (healthy)  
**Next Review**: September 15, 2024
