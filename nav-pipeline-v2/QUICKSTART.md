# Nav Pipeline v2 - Quick Start Guide

**Total Setup Time**: 5-6 hours  
**Complexity**: Intermediate (requires ServiceNow and n8n knowledge)

## What You're Building

An AI-powered system that automatically generates technical specifications for ServiceNow stories when they're assigned to an agent. The system learns from previous specs and improves over time.

```
Story assigned to agent
    ↓
Service Now Business Rule fires
    ↓
n8n gathers project context (4 parallel queries)
    ↓
Claude Opus generates technical spec (5-15 seconds)
    ↓
Spec written to ServiceNow story
    ↓
Developer reviews/approves
    ↓
Story closed → Blueprint automatically updates
```

## Prerequisites

- ✅ n8n running and accessible (you confirmed you have this)
- ✅ ServiceNow instance with admin access
- ✅ Anthropic API key (from console.anthropic.com)
- ✅ 5-6 hours of setup time

## The 4-Step Deployment

### Step 1: ServiceNow Setup (90 min) 📋
**File**: `./servicenow/SETUP.md`

Key tasks:
1. Create service account `nav_pipeline_agent`
2. Add custom field `technical_specification` to Story table
3. Create 2 Business Rules (spec generation + blueprint update)
4. Create REST Message for webhooks
5. Create knowledge article template for blueprints

**Key decision**: Which project will you test on first? Pick one.

---

### Step 2: n8n Setup (120 min) ⚙️
**File**: `./n8n/SETUP.md`

Key tasks:
1. Create credentials (Anthropic API + ServiceNow)
2. Create main workflow:
   - Webhook trigger
   - 4 parallel context gathering branches
   - Claude API call
   - ServiceNow write-back
3. Create blueprint update workflow
4. Activate both workflows
5. Update ServiceNow Business Rules with webhook URLs

**Your webhook URL** will look like: `https://your-n8n.com/webhook/nav-pipeline-main`

---

### Step 3: Testing (165 min) 🧪
**File**: `./TESTING.md`

Quick validation before production:
1. Test main workflow with manual webhook (5 min)
2. Test real Business Rule trigger (5 min)
3. Test blueprint update (5 min)
4. Verify spec quality (15 min)
5. Performance check: <30 seconds total? (10 min)

---

### Step 4: Production Rollout (ongoing) 🚀
**File**: `./DEPLOYMENT.md`

- Enable Business Rules for limited group (test)
- Monitor first 10 specs for quality
- Expand to all users
- Set up monthly blueprint governance (1-2 hours/month)

---

## File Navigation

```
nav-pipeline-v2/
├── README.md                          ← Architecture overview
├── QUICKSTART.md                      ← You are here
├── DEPLOYMENT.md                      ← Phase-by-phase deployment
├── TESTING.md                         ← Test plans (6 test suites)
├── TROUBLESHOOTING.md                 ← 10 common issues + fixes
├── BLUEPRINT_GOVERNANCE.md            ← Monthly review process
│
├── servicenow/                        
│   └── SETUP.md                       ← ServiceNow configuration steps
│
├── n8n/                              
│   ├── SETUP.md                       ← n8n workflow setup
│   └── main-workflow-template.json    ← n8n workflow skeleton
│
├── prompts/                          
│   ├── spec-generation.md             ← Main system prompt (customizable)
│   └── blueprint-extraction.md        ← Blueprint extraction prompt
│
└── config/
    └── env-template.txt               ← Environment variables to set
```

**Where to start**: 
1. Read this file (you're done! ✓)
2. Open `servicenow/SETUP.md` 
3. Follow step-by-step

---

## What Each Component Does

### ServiceNow Business Rules
- **Rule 1**: When story assigned to agent → POST to n8n webhook
- **Rule 2**: When story closed with spec → POST to blueprint update webhook

### n8n Workflows
- **Main Workflow**: Gets context from ServiceNow, calls Claude, writes spec back
- **Blueprint Workflow**: Extracts components from approved spec, updates project blueprint

### Claude Integration
- Uses `claude-opus-5` (most capable model)
- Generates structured technical specs (~1500-3000 tokens)
- Input: story + project context + design principles
- Output: 7-section specification (summary, assumptions, components, changes, data flow, tests, dependencies)

### Knowledge Blueprints
- Living document per project
- Grows with each approved spec
- Becomes context for future specs (self-improving loop)
- Human reviews monthly for accuracy

---

## Key Configuration Points

### Environment Variables (see `config/env-template.txt`)
```
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key
SERVICENOW_INSTANCE_URL=https://... # Your instance
SERVICENOW_USERNAME=nav_pipeline_agent
SERVICENOW_PASSWORD=...
DESIGN_PRINCIPLES_ARTICLE_ID=...    # KB article with your standards
WEBHOOK_AUTH_TOKEN=...              # Security token (optional)
```

### Customization Points
1. **Spec format**: See `prompts/spec-generation.md` (adjustable output sections)
2. **Blueprint structure**: See `prompts/blueprint-extraction.md`
3. **Context gathering**: Add/remove fields in `n8n/SETUP.md` Step 2.3
4. **Trigger condition**: Adjust Business Rule condition in `servicenow/SETUP.md`

---

## Cost Estimate

**Per spec**:
- Claude Opus input/output: ~2500 tokens input + 1500 tokens output
- Cost: ~$0.10 per spec
- Speed: 5-15 seconds

**Monthly** (assuming 50 specs):
- ~$5 for Claude API
- n8n time: negligible (low execution complexity)
- ServiceNow API calls: free (internal)

---

## Common Questions

**Q: Can I use Claude Sonnet instead of Opus?**  
A: Yes, but specs may be less detailed. Opus recommended for complex projects.

**Q: What if a spec is wrong?**  
A: Developer can edit the spec before closing the story. Edits feed back into the blueprint, improving future specs.

**Q: How do I customize the prompt?**  
A: Edit `prompts/spec-generation.md` and update the system prompt in n8n workflow.

**Q: What if ServiceNow doesn't have the field?**  
A: Follow `servicenow/SETUP.md` Step 2 to create it.

**Q: Can I start with a pilot?**  
A: Yes! See `DEPLOYMENT.md` Step 4.4 for staged rollout approach.

---

## Success Checklist

After full deployment, verify:

- ✅ Story assigned to agent → spec generated within 30 seconds
- ✅ Spec format is correct (7 sections, readable)
- ✅ Blueprint updates when story is closed
- ✅ Blueprint helps future specs reference patterns
- ✅ Developers approve majority of specs (>80%)
- ✅ Cost is <$0.20 per spec
- ✅ Latency acceptable (<30 seconds total)

---

## Next Steps

1. **Read** `servicenow/SETUP.md` (bookmark it)
2. **Create** ServiceNow service account (Step 1)
3. **Add** custom field to Story table (Step 2)
4. **Create** Business Rules (Step 3)
5. **When ready**: Start `n8n/SETUP.md`

---

## Support

- **Setup issues**: See the relevant SETUP.md file
- **After deployment errors**: See `TROUBLESHOOTING.md`
- **Quality concerns**: Review `prompts/` and adjust system prompt
- **Monthly maintenance**: Use `BLUEPRINT_GOVERNANCE.md` checklist

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ServiceNow Instance                         │
│  Story assigned → Business Rule fires → Webhook POST             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     n8n Orchestration                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Context Gathering (Parallel - all at once)              │    │
│  │  ├─ Query Project + Knowledge Articles                  │    │
│  │  ├─ Fetch Design Principles Doc                         │    │
│  │  ├─ Query Active Modules/License Entitlements           │    │
│  │  └─ Download Story Attachments                          │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │ (all results combine)                                │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Build Prompt (Function Node)                            │    │
│  │  - System: Architect-agent instructions               │    │
│  │  - User: Story + Project Context + Design Principles   │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Claude API Call (claude-opus-5)                         │    │
│  │  Input: Full formatted prompt                           │    │
│  │  Output: Technical specification (7 sections)           │    │
│  └────────┬────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ServiceNow Write-back                                   │    │
│  │  Write to: technical_specification field on Story       │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   ServiceNow Story Update                         │
│                                                                   │
│  Developer reviews spec:                                         │
│   ✓ Approves (minimal edits) → Story closed → Blueprint updated  │
│   ✗ Rejects (significant edits) → Spec stays, manual review     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Estimated Timeline

- **ServiceNow setup**: 90 minutes (2 hour session recommended)
- **n8n setup**: 120 minutes (2 hour session)
- **Testing**: 165 minutes (3 hours, can be split)
- **Deployment/Rollout**: 1-2 weeks (gradual activation)
- **First month**: Monthly blueprint governance (1-2 hours/month)

**Total upfront effort**: 5-6 hours  
**Ongoing effort**: 1-2 hours/month

---

Good luck! Start with `servicenow/SETUP.md` → it's the foundation. 🚀
