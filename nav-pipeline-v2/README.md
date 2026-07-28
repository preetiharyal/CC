# Nav Pipeline v2 - Implementation Guide (AG01_arch)

AI-driven technical specification generation for ServiceNow stories with self-updating architecture blueprints. Powered by AG01_arch, a ServiceNow solutions architect agent.

## Overview

This pipeline automates the creation of detailed technical specifications for ServiceNow stories by:
1. **Gathering context** from your ServiceNow instance (project info, design principles, module entitlements, precedent specs)
2. **Generating specs** using Claude Opus via AI-driven analysis
3. **Updating blueprints** automatically as specs are approved, creating a self-improving knowledge base

## Architecture

```
ServiceNow Business Rule (Story assignment)
          ↓
    n8n Webhook Trigger
          ↓
    Context Gathering (4 parallel branches)
     ├─ Project Context
     ├─ Design Principles
     ├─ Module Entitlements
     └─ Story Attachments
          ↓
    Claude API (Spec Generation)
          ↓
    ServiceNow Write-back (technical_specification field)
          ↓
    [Developer Reviews/Edits]
          ↓
    Story Closed → Blueprint Update Trigger
          ↓
    Blueprint Extraction Agent (Claude)
          ↓
    Update Knowledge Article Blueprint
```

## Components

### 1. ServiceNow Configuration (`./servicenow/`)
- Business Rules for triggering
- Custom field definitions
- Knowledge article templates for blueprints
- Script includes for ServiceNow integration

### 2. n8n Workflows (`./n8n/`)
- Main orchestration workflow
- Context gathering workflow
- Blueprint update workflow

### 3. Claude Prompts (`./prompts/`)
- Spec generation system prompt
- Blueprint extraction system prompt

### 4. Environment & Configuration (`./config/`)
- Environment variable templates
- n8n connection setup guide
- API authentication patterns

## Quick Start

1. **Setup n8n** (you already have n8n running)
   - See `./n8n/SETUP.md`

2. **Configure ServiceNow**
   - See `./servicenow/SETUP.md`

3. **Deploy n8n Workflows**
   - Import the workflow JSONs into n8n
   - Configure n8n nodes with your instance details

4. **Test the Pipeline**
   - See `./TESTING.md`

## Key Files

| File | Purpose |
|------|---------|
| `prompts/spec-generation.md` | Main architect-agent prompt for generating specs |
| `prompts/blueprint-extraction.md` | Agent prompt for updating project blueprints |
| `n8n/main-workflow.json` | Primary orchestration workflow |
| `n8n/blueprint-update-workflow.json` | Blueprint refresh workflow |
| `servicenow/business-rules.js` | ServiceNow trigger Business Rules |
| `servicenow/knowledge-article-template.md` | Blueprint knowledge article template |

## Configuration

All sensitive values (API keys, instance URLs, credentials) should be stored as n8n environment variables, not in code.

See `./config/env-template.txt` for required variables.

## Models Used

- **Spec Generation**: Claude 5 Opus (claude-opus-5)
- **Blueprint Extraction**: Claude 5 Opus (claude-opus-5)

See `./prompts/` for full prompt definitions.

## Workflow Triggers

### Main Specification Pipeline
- **Trigger**: ServiceNow Business Rule on Story table
- **Condition**: `assigned_to` changes AND `assigned_to` == agent service account
- **Action**: POST to n8n webhook with story data

### Blueprint Update Pipeline
- **Trigger**: ServiceNow Business Rule on Story table
- **Condition**: `technical_specification` is not empty AND `state` changes to Closed/Complete
- **Action**: POST to n8n webhook for blueprint extraction

## Key Design Decisions

1. **Event-Driven**: Uses ServiceNow Business Rules (not polling) for low latency
2. **Context-First**: Gathers all relevant context before calling the LLM (4 parallel branches)
3. **Self-Improving**: Blueprints grow with each approved spec, creating a knowledge compounding loop
4. **Scoped Access**: Uses service account with minimal necessary permissions
5. **Feedback Loop**: Developer edits on rejected specs feed back into future generations

## Cost & Performance Considerations

- **Context gathering** (parallel n8n queries): ~2-3 seconds
- **Claude API call**: ~5-15 seconds (depending on context size)
- **Write-back**: ~1 second
- **Total latency**: ~10-20 seconds per story
- **Cost**: ~$0.05-0.15 per spec (Claude Opus input/output tokens)

## Maintenance

### Monthly/Quarterly Blueprint Review
Review blueprints for drift (one-off exceptions captured as standards, deprecated items):
- See `./BLUEPRINT_GOVERNANCE.md`
- ~1-2 hours per quarter for active projects

### Adding New Projects
1. Create a new Knowledge Article for the project blueprint
2. Add project reference to n8n configuration
3. First spec for the project will bootstrap the blueprint

## Support & Troubleshooting

See `./TROUBLESHOOTING.md` for common issues and solutions.

## Next Steps

1. Read `./servicenow/SETUP.md` to configure ServiceNow
2. Read `./n8n/SETUP.md` to deploy n8n workflows
3. Review `./prompts/` for customization points
4. Follow `./TESTING.md` for validation
