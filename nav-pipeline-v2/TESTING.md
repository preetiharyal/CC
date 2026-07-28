# End-to-End Testing Guide

## Prerequisites

- ServiceNow configuration complete (see `./servicenow/SETUP.md`)
- n8n workflows deployed (see `./n8n/SETUP.md`)
- All credentials configured in n8n
- Sample project and story created in ServiceNow for testing

## Test 1: Main Workflow (Spec Generation)

### Test 1.1: Manual Webhook Trigger

1. **In n8n**:
   - Open workflow: `Arch Jr - Generate Technical Specification`
   - Click "Test Webhook" button
   - You'll see a webhook URL displayed

2. **Test webhook with curl** (or Postman):
   ```bash
   curl -X POST https://your-n8n.com/webhook/arch-jr-main \
     -H "Content-Type: application/json" \
     -d '{
       "sys_id": "test123456789",
       "number": "STORY-TEST-001",
       "short_description": "Add custom field to incident form",
       "description": "We need to track custom data on incidents",
       "acceptance_criteria": "Field appears on incident form and saves correctly",
       "parent": "test_epic",
       "project": "test_project_id",
       "assigned_to": "AG01_arch",
       "timestamp": "2024-07-27T12:00:00Z"
     }'
   ```

3. **Monitor execution**:
   - Watch the workflow execution in n8n
   - Each node should complete successfully:
     - ✓ Webhook received
     - ✓ Context gathering (4 branches in parallel)
     - ✓ Build prompt function
     - ✓ Claude API call
     - ✓ ServiceNow write-back

4. **Verify in ServiceNow**:
   - Open the test story
   - Check that `technical_specification` field now contains generated spec
   - Spec should follow the format from `prompts/spec-generation.md`

### Test 1.2: Real Business Rule Trigger

1. **Create a test story in ServiceNow**:
   - **Summary**: "Test - Create custom field on request table"
   - **Description**: "Add tracking field for custom requirement"
   - **Acceptance Criteria**: "Field visible on form, data persists"
   - **Project**: Your test project

2. **Assign to agent**:
   - Change `assigned_to` to `AG01_arch` (the service account)
   - Save the story

3. **Monitor the trigger**:
   - Check n8n executions for the webhook call
   - Business Rule should have fired automatically
   - Verify spec was written within 30 seconds

4. **Verify output quality**:
   - Read the generated spec
   - Check that it:
     - Summarizes the requirement correctly
     - References any existing patterns from PRECEDENT_SPECS
     - Follows DESIGN_PRINCIPLES for naming
     - Flags any missing module entitlements
     - Provides step-by-step implementation details

### Test 1.3: Context Accuracy

Verify that context gathered is accurate:

1. **Create a project blueprint article** in ServiceNow:
   - Title: `[Test Project] Blueprint`
   - Content: Bootstrap with a simple entry

2. **Create precedent specs** (add as comments/attachments to project):
   - Simple example showing naming convention
   - Example showing integration pattern

3. **Generate a new spec** for a story in this project

4. **Verify in the spec output**:
   - ✓ PROJECT_CONTEXT references mentioned in the spec
   - ✓ PRECEDENT_SPECS patterns called out (e.g., "Following the naming pattern from STORY-001...")
   - ✓ DESIGN_PRINCIPLES standards applied
   - ✓ MODULE_ENTITLEMENTS respected (no "ideal but unlicensed" modules proposed)

## Test 2: Blueprint Update Workflow

### Test 2.1: Manual Blueprint Update

1. **Create test scenario**:
   - Create/open project blueprint article
   - Create a story with approved technical spec

2. **Manually trigger blueprint update**:
   - In n8n, click webhook test
   - Send sample payload:
   ```json
   {
     "sys_id": "story_id",
     "number": "STORY-TEST-002",
     "state": "closed",
     "technical_specification": "## Summary\nAdded new integration endpoint\n\n## Affected Components\n- REST API call to external system",
     "project": "test_project_id",
     "timestamp": "2024-07-27T12:00:00Z"
   }
   ```

3. **Monitor execution**:
   - Watch blueprint extraction workflow run
   - Verify Claude extracts components from the spec

4. **Verify blueprint update**:
   - Check the project blueprint article in ServiceNow
   - New entries should appear in appropriate sections
   - "Last Updated" should reflect the story number and date

### Test 2.2: Real Trigger (Story Closure)

1. **Use spec from Test 1.2**:
   - Developer approves/edits the spec (minimal edits)
   - Change story state to `Closed`

2. **Monitor**:
   - Blueprint update workflow should trigger automatically
   - Check n8n executions

3. **Verify**:
   - Open project blueprint article
   - Confirm new components added from this spec
   - Check "Last Updated" timestamp

## Test 3: Edge Cases & Error Handling

### Test 3.1: Missing Context

1. **Scenario**: Project with no precedent specs or attachments
2. **Expected**: Spec still generates, but notes in "Assumptions & Flags": "No prior specs found for this project"
3. **Test**: Create story in a new project, verify spec handles gracefully

### Test 3.2: Unlicensed Module

1. **Scenario**: Story needs Feature X, but module not in MODULE_ENTITLEMENTS
2. **Expected**: Spec flags in "Assumptions & Flags" and proposes alternative
3. **Test**: 
   - In ServiceNow, deactivate a module temporarily
   - Generate spec for a story requiring that module
   - Verify spec flags the gap and suggests alternative

### Test 3.3: Large Context

1. **Scenario**: Project with many precedent specs, large attachments
2. **Expected**: Spec still generates, but may hit token limit
3. **Test**:
   - Add 20+ precedent specs to project context
   - Generate new spec
   - Monitor token usage in n8n logs
   - If token limit hit, blueprint retrieval should be scoped down

### Test 3.4: Failed Claude API Call

1. **Scenario**: Claude API unreachable or rate-limited
2. **Expected**: n8n catches error and notifies
3. **Test**:
   - Temporarily disable API key in n8n credential
   - Trigger workflow
   - Verify error message captured
   - Enable key and retry (n8n should support retry logic)

### Test 3.5: ServiceNow Write-back Failure

1. **Scenario**: Service account lost write permission on field
2. **Expected**: Workflow fails at write-back stage, logs error
3. **Test**:
   - Temporarily remove write access from service account
   - Trigger workflow
   - Verify failure is caught and logged
   - Restore access

## Test 4: Performance & Latency

### Test 4.1: Context Gathering Speed

1. **Measure timing**:
   - n8n shows execution time for each node
   - Context gathering nodes should run in parallel
   - Total time for all 4 branches: ~2-3 seconds

2. **Test with different context sizes**:
   - Small project: <5 prior specs, <2 attachments
   - Large project: 20+ prior specs, 10+ attachments
   - Measure how timing changes

3. **Optimize if needed**:
   - Cache design principles (doesn't change per-story)
   - Limit precedent specs to most recent 5-10
   - Retrieve blueprint sections instead of full document

### Test 4.2: Total Pipeline Latency

1. **Measure end-to-end time**:
   - From story assignment to spec written
   - Record start time when assigning to agent
   - Record end time when spec appears in ServiceNow
   - Target: <30 seconds total

2. **Breakdown**:
   - n8n execution: ~15-20 seconds (context + Claude + write-back)
   - ServiceNow Business Rule + API calls: ~5-10 seconds

### Test 4.3: Cost per Spec

1. **Monitor Claude token usage**:
   - Check n8n logs for token counts (input + output)
   - Typical: 2000-3000 input tokens, 500-2000 output tokens

2. **Estimate cost**:
   - Claude Opus 5: $15 per 1M input tokens, $45 per 1M output tokens
   - Example: 2500 input + 1500 output = 2500×$15/1M + 1500×$45/1M ≈ $0.10 per spec

## Test 5: Quality Assurance

### Test 5.1: Spec Accuracy

Generate 5 test specs and have a developer review:

1. **Check each spec for**:
   - ✓ Accurate summary of requirement
   - ✓ Realistic implementation steps
   - ✓ Correct naming conventions applied
   - ✓ Relevant precedent specs referenced
   - ✓ All affected components listed
   - ✓ Test considerations make sense

2. **Collect feedback**:
   - Mark any inaccuracies
   - Note if Claude missed important context
   - Check if assumptions flagged are correct

3. **Iterate prompts** if needed:
   - See `prompts/spec-generation.md` for customization points
   - Adjust system prompt based on developer feedback

### Test 5.2: Blueprint Accuracy

After updating blueprint from 3-5 specs:

1. **Review blueprint**:
   - Does it accurately reflect what was implemented?
   - Are naming conventions correct?
   - Are components in right sections?

2. **Use blueprint in next spec**:
   - Generate new spec for a story in the project
   - Verify new spec references the blueprint correctly
   - Developer should see familiar patterns

## Test 6: Integration Scenarios

### Test 6.1: Multiple Stories in Sequence

1. **Create 3 related stories** in same project
2. **Assign first story**: Wait for spec, developer approves, close story
3. **Assign second story**: Verify spec references first story's patterns via blueprint
4. **Assign third story**: Verify it references both prior stories

**Expected outcome**: With each spec, the blueprint grows and future specs become more consistent

### Test 6.2: Concurrent Triggers

1. **Create 2-3 stories** simultaneously
2. **Assign all to agent** at the same time
3. **Monitor n8n**:
   - Workflows should queue/run in parallel
   - All specs should complete without interference
   - No data corruption

### Test 6.3: Developer Feedback Loop

1. **Generate spec**
2. **Developer edits** technical_specification field (e.g., simplifies a step)
3. **Close story**
4. **Monitor**:
   - Blueprint update should still work
   - Blueprint reflects approved (edited) spec, not original
   - Show that feedback improved blueprint accuracy

## Rollout Checklist

Before deploying to production:

- [ ] All individual tests pass (Test 1-3)
- [ ] Performance acceptable (Test 4)
- [ ] Quality reviewed by developers (Test 5)
- [ ] Integration scenarios work (Test 6)
- [ ] Error handling catches known failures
- [ ] Monitoring/alerts configured in n8n
- [ ] Blueprints seeded for active projects
- [ ] Team trained on using the system
- [ ] Monthly governance schedule set

## Post-Rollout Monitoring

After going live:

1. **Week 1**: Monitor every spec, catch any issues
2. **Week 2-4**: Spot-check 50% of specs, review quality trends
3. **Monthly**: 
   - Review blueprint drift
   - Analyze failed/retry specs
   - Adjust prompts or context gathering if patterns emerge

## Troubleshooting

**Specs missing context?**
- Check context gathering nodes completed successfully
- Verify ServiceNow queries returning data
- Increase context limits if truncated

**Blueprints inaccurate?**
- Have humans review monthly
- Adjust extraction rules if patterns emerging
- Consider adding structure to spec output format

**Slow performance?**
- Profile each node in n8n
- Cache static data (design principles, active plugins)
- Reduce precedent spec context if >10

**High costs?**
- Monitor token usage trends
- Optimize prompts to be more concise
- Consider using Claude Sonnet for simpler specs
