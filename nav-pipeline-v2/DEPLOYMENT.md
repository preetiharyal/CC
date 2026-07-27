# Nav Pipeline v2 - Deployment Guide

## Overview

This guide walks you through deploying Nav Pipeline v2 to your production environment. The deployment has two main phases: **ServiceNow Configuration** and **n8n Workflow Deployment**.

## Phase 1: ServiceNow Configuration (Day 1-2)

### Step 1.1: Create Service Account
**Time**: 15 minutes

Follow `./servicenow/SETUP.md` Step 1:
- [ ] Create user `nav_pipeline_agent`
- [ ] Assign `nav_pipeline_writer` role
- [ ] Verify role has correct ACLs

### Step 1.2: Add Custom Field
**Time**: 10 minutes

Follow `./servicenow/SETUP.md` Step 2:
- [ ] Add `technical_specification` field to Story table
- [ ] Type: Text (Large)
- [ ] Set write permission to `nav_pipeline_writer` role

### Step 1.3: Create Business Rules
**Time**: 30 minutes

Follow `./servicenow/SETUP.md` Step 3:
- [ ] Create Business Rule: `Nav Pipeline - Generate Spec on Assignment`
  - Condition: `assigned_to` changes to agent service account
  - Action: POST to n8n webhook
- [ ] Create Business Rule: `Nav Pipeline - Update Blueprint on Story Close`
  - Condition: `technical_specification` not empty AND state changes to Closed
  - Action: POST to n8n webhook for blueprint update

### Step 1.4: Setup REST Messages
**Time**: 15 minutes

Follow `./servicenow/SETUP.md` Step 5:
- [ ] Create REST Message for webhook calls
- [ ] Test with sample payload

### Step 1.5: Create Blueprint Knowledge Article Template
**Time**: 20 minutes

Follow `./servicenow/SETUP.md` Step 4:
- [ ] Create Knowledge Article category: `Technical Blueprints`
- [ ] Create sample blueprint article for test project
- [ ] Structure: Tables, Integrations, Business Rules, Naming Conventions, Known Gaps, Last Updated

**Total Phase 1 Time**: ~90 minutes

---

## Phase 2: n8n Workflow Deployment (Day 2-3)

### Step 2.1: Configure n8n Credentials
**Time**: 20 minutes

Follow `./n8n/SETUP.md` Step 1:
- [ ] Add Anthropic API credential (x-api-key header auth)
- [ ] Add ServiceNow OAuth2 or Basic Auth credential
- [ ] Test each credential

### Step 2.2: Create Main Workflow
**Time**: 45 minutes

Follow `./n8n/SETUP.md` Step 2:
- [ ] Create new workflow: `Nav Pipeline - Generate Technical Specification`
- [ ] Add Webhook trigger node (path: `/nav-pipeline-main`)
- [ ] Add context gathering nodes (4 parallel branches):
  - Project context (query project record + knowledge articles + attachments)
  - Design principles (fetch static document)
  - Module entitlements (query active plugins + static license doc)
  - Story attachments
- [ ] Add function node to build Claude prompt
- [ ] Add HTTP request node for Claude API call
- [ ] Add ServiceNow update node to write spec
- [ ] Add error handling and logging
- [ ] Test webhook (get webhook URL for ServiceNow Business Rule)

### Step 2.3: Create Blueprint Update Workflow
**Time**: 30 minutes

Follow `./n8n/SETUP.md` Step 3:
- [ ] Create new workflow: `Nav Pipeline - Update Project Blueprint`
- [ ] Add Webhook trigger (path: `/nav-pipeline-blueprint-update`)
- [ ] Add node to fetch current blueprint from ServiceNow
- [ ] Add function node to build extraction prompt
- [ ] Add HTTP request for Claude extraction call
- [ ] Add ServiceNow update node to write blueprint
- [ ] Test webhook

### Step 2.4: Configure Environment Variables
**Time**: 10 minutes

Follow `./config/env-template.txt`:
- [ ] Set `ANTHROPIC_API_KEY`
- [ ] Set `SERVICENOW_INSTANCE_URL`
- [ ] Set `DESIGN_PRINCIPLES_ARTICLE_ID`
- [ ] Set `WEBHOOK_AUTH_TOKEN`
- [ ] Set other optional variables

### Step 2.5: Update ServiceNow Business Rules with n8n URLs
**Time**: 10 minutes

- [ ] Copy webhook URL from main workflow
- [ ] Update Business Rule `Nav Pipeline - Generate Spec on Assignment` with exact URL
- [ ] Copy webhook URL from blueprint workflow
- [ ] Update Business Rule `Nav Pipeline - Update Blueprint on Story Close` with exact URL

### Step 2.6: Activate Workflows
**Time**: 5 minutes

- [ ] Open main workflow, click "Activate"
- [ ] Open blueprint workflow, click "Activate"
- [ ] Verify both show "Active" status

**Total Phase 2 Time**: ~120 minutes

---

## Phase 3: Testing & Validation (Day 3-4)

### Step 3.1: Unit Tests
**Time**: 60 minutes

Follow `./TESTING.md` Tests 1-3:
- [ ] Test main workflow with manual webhook trigger
- [ ] Test main workflow with real ServiceNow Business Rule
- [ ] Verify spec format matches requirements
- [ ] Test blueprint update workflow
- [ ] Test edge cases (missing context, unlicensed modules, etc.)

### Step 3.2: Performance Tests
**Time**: 30 minutes

Follow `./TESTING.md` Test 4:
- [ ] Measure context gathering latency (<3 seconds)
- [ ] Measure total pipeline latency (<30 seconds)
- [ ] Estimate cost per spec (<$0.20)
- [ ] Monitor Claude token usage

### Step 3.3: Quality Review
**Time**: 45 minutes

Follow `./TESTING.md` Test 5:
- [ ] Have developer review 5 generated specs
- [ ] Verify accuracy of recommendations
- [ ] Check if design principles are followed
- [ ] Gather feedback on improvements

### Step 3.4: Integration Tests
**Time**: 30 minutes

Follow `./TESTING.md` Test 6:
- [ ] Test multiple stories in sequence
- [ ] Verify blueprint grows and improves
- [ ] Test developer feedback loop

**Total Phase 3 Time**: ~165 minutes (3-4 hours)

---

## Phase 4: Production Rollout (Day 4-5)

### Step 4.1: Setup Monitoring & Alerts
**Time**: 30 minutes

- [ ] Configure n8n notification for workflow failures
- [ ] Setup email alerts to architecture team
- [ ] Optional: Setup Slack integration for real-time alerts
- [ ] Create n8n dashboard to monitor execution rates

### Step 4.2: Team Training
**Time**: 45 minutes

- [ ] Explain pipeline to development team
- [ ] Show how specs are generated and reviewed
- [ ] Explain approval/feedback loop
- [ ] Share expected workflow (story → assignment → spec generation → review)

### Step 4.3: Documentation
**Time**: 30 minutes

- [ ] Ensure team can access README.md
- [ ] Share troubleshooting guide (TROUBLESHOOTING.md)
- [ ] Document any custom configurations
- [ ] Create team wiki page or Confluence doc with quick start

### Step 4.4: Gradual Rollout
**Time**: 5-10 days

**Option A: Staged Rollout**
1. **Day 1**: Test with 1-2 stories in a non-critical project
2. **Day 2-3**: Expand to 3-5 stories in multiple projects
3. **Day 4-5**: Full rollout - all stories can trigger pipeline

**Option B: Soft Launch**
1. Deploy workflows but don't activate Business Rules yet
2. Test manually for 1-2 days
3. Activate Business Rules for limited group first
4. Expand to all users

### Step 4.5: Monitor & Optimize
**Time**: Ongoing (first 2 weeks)

**Week 1**:
- [ ] Monitor every spec generated
- [ ] Catch any issues early
- [ ] Adjust prompts if quality issues emerge
- [ ] Collect developer feedback

**Week 2**:
- [ ] Spot-check 50% of specs
- [ ] Review quality trends
- [ ] Optimize performance (reduce latency, cost)

**Week 3+**:
- [ ] Ongoing monitoring
- [ ] Monthly blueprint review (see BLUEPRINT_GOVERNANCE.md)

---

## Rollout Checklist

### Pre-Deployment
- [ ] All team members have ServiceNow access
- [ ] n8n instance is stable and accessible
- [ ] API keys obtained (Anthropic, ServiceNow)
- [ ] Network connectivity verified (n8n ↔ ServiceNow, n8n ↔ Anthropic API)

### ServiceNow Configuration
- [ ] Service account created
- [ ] Custom field added
- [ ] Business Rules created and tested
- [ ] REST Messages configured
- [ ] Blueprint article template created

### n8n Configuration
- [ ] Credentials configured (Anthropic, ServiceNow)
- [ ] Main workflow created and tested
- [ ] Blueprint update workflow created and tested
- [ ] Environment variables set
- [ ] Webhooks connected to Business Rules

### Testing
- [ ] Unit tests passed (Tests 1-3)
- [ ] Performance acceptable (Test 4)
- [ ] Quality reviewed (Test 5)
- [ ] Integration tests passed (Test 6)

### Production
- [ ] Monitoring alerts configured
- [ ] Team trained
- [ ] Documentation available
- [ ] Gradual rollout plan in place

---

## Post-Deployment Schedule

### Immediately (Day 1)
- Monitor all specs generated
- Catch any runtime errors
- Provide immediate support to team

### Week 1
- Monitor 100% of specs
- Resolve any issues
- Collect feedback

### Week 2
- Monitor 50% of specs
- Begin tweaking prompts based on feedback
- Optimize performance

### Month 1
- Perform monthly blueprint governance review (first time)
- Analyze cost and token usage
- Plan any improvements

### Ongoing (Monthly/Quarterly)
- Blueprint governance review (see BLUEPRINT_GOVERNANCE.md)
- Cost analysis and optimization
- Prompt refinement as patterns emerge

---

## Rollback Plan

If critical issues emerge:

### Minor Issues (Quality)
- Pause new story assignments to agent (manual intervention)
- Adjust prompt (see `prompts/spec-generation.md`)
- Resume after testing

### Moderate Issues (Some Failures)
- Disable blueprint update workflow (keep spec generation)
- Fix n8n nodes
- Re-enable after testing

### Critical Issues (Complete Failure)
1. Deactivate main Business Rule in ServiceNow
   - Stories can still be assigned manually
   - Specs won't be auto-generated
2. Investigate n8n/API issues
3. Fix and re-enable

**Note**: Rollback is quick (minutes) because pipeline is optional. Development continues even if disabled.

---

## Success Metrics

After 1 month, you should see:

✅ **Velocity**: Specs generated within 30 seconds of story assignment  
✅ **Quality**: Developers finding specs helpful (>80% approval rate)  
✅ **Accuracy**: Specs reference correct precedents and patterns  
✅ **Cost**: <$5 per 100 specs (~$0.05 per spec)  
✅ **Adoption**: All new stories using pipeline  
✅ **Knowledge**: Blueprint growing with each story  

---

## Troubleshooting Deployment

**Webhook not triggering?**
- See TROUBLESHOOTING.md Issue #1
- Test Business Rule condition manually
- Verify REST Message endpoint

**Specs not writing to ServiceNow?**
- See TROUBLESHOOTING.md Issue #2
- Check service account permissions
- Test write operation manually

**Claude API errors?**
- See TROUBLESHOOTING.md Issue #3
- Verify API key is valid
- Check request format

**Poor spec quality?**
- See TROUBLESHOOTING.md Issue #6
- Review prompts in `prompts/`
- Adjust system prompt based on examples

---

## Support & Escalation

### For Implementation Questions
→ Review the relevant SETUP.md file (servicenow/ or n8n/)

### For Troubleshooting
→ See TROUBLESHOOTING.md for common issues

### For Spec Quality Issues
→ See prompts/ directory for customization points

### For Blueprint Governance
→ See BLUEPRINT_GOVERNANCE.md for monthly review process

---

## Next Steps

1. **Assign owner**: Who will manage this after deployment?
2. **Set governance cadence**: Monthly or quarterly blueprint reviews?
3. **Plan monitoring**: Email, Slack, dashboard alerts?
4. **Schedule training**: When will team learn the system?
5. **Document customizations**: Any custom rules or business logic?

Start with Phase 1 (ServiceNow configuration) — it's the foundation everything else depends on.

Good luck! 🚀
