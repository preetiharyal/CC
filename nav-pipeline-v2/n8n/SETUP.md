# n8n Workflow Setup

## Prerequisites

- n8n instance running and accessible
- ServiceNow instance with Business Rules configured (see `../servicenow/SETUP.md`)
- Anthropic API key for Claude Opus access
- ServiceNow OAuth2 or API key authentication configured

## Step 1: Configure n8n Credentials

### 1.1 Anthropic/Claude API

In n8n:
1. **Settings > Credentials > Create New**
2. **Type**: HTTP Header Auth (or create custom credential)
3. **Name**: `Anthropic API`
4. **Headers**:
   - `Authorization`: `Bearer <your-anthropic-api-key>`
   - `anthropic-version`: `2023-06-01`

### 1.2 ServiceNow OAuth2 / API

In n8n:
1. **Settings > Credentials > Create New**
2. **Type**: ServiceNow OAuth2 (or HTTP Basic Auth)
3. **Name**: `ServiceNow Instance`
4. **Configuration**:
   - **Instance URL**: `https://your-instance.service-now.com`
   - **Username**: `nav_pipeline_agent`
   - **Password**: (use OAuth2 or API token)
   - **Client ID/Secret**: (if using OAuth2)

### 1.3 Webhook Authentication Token (Optional but Recommended)

In n8n:
1. Generate a secure random token: `openssl rand -hex 32`
2. Store as n8n environment variable: `WEBHOOK_AUTH_TOKEN`
3. Configure Business Rules to include this token in headers

## Step 2: Create n8n Workflow - Main Spec Generation

### 2.1 Import or Create Workflow

1. In n8n, click **Create New Workflow** or import `./main-workflow.json`
2. **Workflow Name**: `Nav Pipeline - Generate Technical Specification`

### 2.2 Configure Webhook Trigger Node

1. **Add Node > Webhooks > Webhook**
2. **Name**: `Main Webhook`
3. **HTTP Method**: POST
4. **Path**: `/nav-pipeline-main`
5. **Authentication**: (optional) Header validation for token
6. **Click Test** to generate webhook URL
7. Copy webhook URL → update in ServiceNow Business Rule

### 2.3 Configure Context Gathering (Parallel Branches)

Each branch queries a different ServiceNow table. All run in parallel, resolving before Claude call:

#### Branch A: Project Context

1. **ServiceNow > Get Record**
   - **Credentials**: ServiceNow Instance
   - **Table**: `project`
   - **Record ID**: `{{ $json.payload.project }}`
   
2. **ServiceNow > Get Records** (Knowledge Articles)
   - **Table**: `kb_knowledge`
   - **Query**: Filter by `related_to = {{ $json.project.sys_id }}`
   - **Limit**: 10

3. **ServiceNow > Get Records** (Attachments)
   - **Table**: `sys_attachment`
   - **Query**: Filter by `table_name = project AND table_sys_id = {{ $json.project.sys_id }}`

4. **Extract Text from Attachments**
   - For each attachment, download content via ServiceNow API
   - If PDF/DOCX: extract text (use text extraction node)
   - Store combined text

#### Branch B: Design Principles

1. **ServiceNow > Get Record** (Knowledge Article)
   - **Table**: `kb_knowledge`
   - **Query**: `sys_id = <your-design-principles-article-id>`
   - Cache this (doesn't change often)

#### Branch C: Module Entitlements

1. **ServiceNow > Get Records**
   - **Table**: `sys_plugins`
   - **Query**: `active = true`
   - Extract active plugin list

2. **Function Node** (combine with static entitlements doc)
   - Add static license cap info from file/constant
   - Merge with active plugins

#### Branch D: Story Attachments

1. **ServiceNow > Get Records**
   - **Table**: `sys_attachment`
   - **Query**: Filter by `table_name = story AND table_sys_id = {{ $json.payload.sys_id }}`

2. **Extract text from attachments** (same as Branch A)

### 2.4 Configure Claude API Call

1. **Add Node > HTTP Request**
   - **Name**: `Claude Spec Generation`
   - **Method**: POST
   - **URL**: `https://api.anthropic.com/v1/messages`
   - **Authentication**: Use Anthropic API credential

2. **Headers**:
   - `Content-Type`: `application/json`
   - `x-api-key`: (from credential)
   - `anthropic-version`: `2023-06-01`

3. **Body** (JSON):
```json
{
  "model": "claude-opus-5",
  "max_tokens": 4000,
  "system": "{{$json.systemPrompt}}",
  "messages": [
    {
      "role": "user",
      "content": "{{$json.userMessage}}"
    }
  ]
}
```

4. **Before this node, add a Function Node** to construct the prompt:
   - Combine all context from branches A-D
   - Read `../prompts/spec-generation.md` for system prompt
   - Build user message with story details + gathered context
   - Return `systemPrompt` and `userMessage`

### 2.5 Configure ServiceNow Write-back

1. **Add Node > ServiceNow > Update Record**
   - **Table**: `story`
   - **Record ID**: `{{ $json.payload.sys_id }}`
   - **Fields to Update**:
     - `technical_specification`: `{{ $json.claude_response.content[0].text }}`
   - **Credentials**: ServiceNow Instance

### 2.6 Configure Error Handling

1. **Add Error Trigger Node**
   - On failure, send notification (email, Slack, etc.)
   - Log error details to n8n logs
   - Optional: Create incident in ServiceNow for failures

2. **Optional: Developer Notification**
   - Send comment on story notifying developer that spec was generated

## Step 3: Create n8n Workflow - Blueprint Update

### 3.1 Import or Create Workflow

1. **Create New Workflow**: `Nav Pipeline - Update Project Blueprint`
2. Import `./blueprint-update-workflow.json` or create manually

### 3.2 Configure Webhook Trigger

1. **Add Node > Webhooks > Webhook**
2. **Path**: `/nav-pipeline-blueprint-update`

### 3.3 Configure Blueprint Extraction

1. **ServiceNow > Get Record**
   - **Table**: `kb_knowledge`
   - **Query**: Find blueprint article for this project
   - Store current blueprint content

2. **Function Node**: Build extraction prompt
   - Read `../prompts/blueprint-extraction.md`
   - Prepare current blueprint + new approved spec

3. **HTTP Request Node** → Claude API
   - Same as main workflow, but with blueprint extraction system prompt
   - Response will be updated blueprint content

4. **ServiceNow > Update Record**
   - **Table**: `kb_knowledge`
   - **Record**: The blueprint article
   - **Field**: `content` or `text`
   - Update with blueprint from Claude response

### 3.4 Update Last-Modified Timestamp

1. Add field to blueprint: "Last Updated: (Story X) - (Date)"
2. Update in write-back node

## Step 4: Configure Environment Variables

Create `.env` file or n8n environment variables:

```bash
# Claude API
ANTHROPIC_API_KEY=your-key-here

# ServiceNow
SERVICENOW_INSTANCE_URL=https://your-instance.service-now.com
SERVICENOW_USERNAME=nav_pipeline_agent
SERVICENOW_PASSWORD=your-password

# Design Principles Document ID
DESIGN_PRINCIPLES_ARTICLE_ID=<kb_knowledge sys_id>

# Webhook Security
WEBHOOK_AUTH_TOKEN=<random-token-from-step-1>

# Logging
LOG_LEVEL=info
```

## Step 5: Test the Workflow

### 5.1 Test Main Workflow

1. **In n8n**: Open the main workflow
2. **Click "Test Webhook"** button
3. **Sample Payload**:
```json
{
  "sys_id": "0123456789abcdef",
  "number": "STORY-001",
  "short_description": "Create dashboard for incident metrics",
  "description": "Build a dashboard showing key incident KPIs",
  "acceptance_criteria": "Dashboard shows real-time incident count and resolution time",
  "parent": "PRJ001",
  "project": "0123456789project",
  "assigned_to": "nav_pipeline_agent",
  "timestamp": "2024-07-27T12:00:00.000Z"
}
```
4. Monitor execution and check logs
5. Verify output in ServiceNow (technical_specification field)

### 5.2 Test Blueprint Update Workflow

1. Manually trigger with sample completed story data
2. Verify blueprint article is updated in ServiceNow

## Step 6: Deploy & Monitor

### 6.1 Activate Workflows

1. In n8n: Open each workflow
2. **Click "Activate"** toggle

### 6.2 Monitor Executions

1. **n8n > Executions**: Monitor both workflows
2. Set up alerts for failures:
   - Email notification on error
   - Slack integration (optional)

### 6.3 Performance Optimization

- **Context gathering parallelization**: Ensure all 4 branches run in parallel
- **Token counting**: Monitor Claude token usage (input/output) per spec
- **Caching**: Cache design principles (doesn't change often)
- **Rate limiting**: Consider adding delays between concurrent requests

## Workflow File Structure

- `main-workflow.json` - Full spec generation workflow (importable into n8n)
- `blueprint-update-workflow.json` - Blueprint extraction and update workflow
- `prompts/` - System prompts for Claude calls (referenced by function nodes)

## Troubleshooting

**Webhook not receiving calls?**
- Verify Business Rule condition is correct
- Check n8n webhook URL matches exactly
- Test with curl: `curl -X POST https://your-n8n.com/webhook/nav-pipeline-main -d '...'`

**Claude API errors?**
- Check API key is valid
- Verify request format matches Anthropic API spec
- Check token usage in Anthropic dashboard

**ServiceNow queries returning empty?**
- Verify ServiceNow credentials have read access
- Check table names and field names are correct
- Test queries in ServiceNow directly

**Slow performance?**
- Check if context gathering branches are running in parallel
- Reduce token limit or context size
- Consider caching static data

## Next Steps

1. Test end-to-end workflow in `../TESTING.md`
2. Review performance and optimize as needed
3. Set up monitoring and alerts
