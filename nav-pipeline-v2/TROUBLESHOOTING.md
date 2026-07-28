# Troubleshooting Guide

## Common Issues & Solutions

### 1. Webhook Not Receiving Calls from ServiceNow

**Symptom**: You trigger a story (assign to agent), but n8n webhook doesn't fire.

**Check List**:

1. **Verify Business Rule exists**
   ```
   In ServiceNow: System Policy > Business Rules
   Search for "Arch Jr"
   Status should be "Active"
   ```

2. **Check Business Rule condition**
   ```javascript
   // Condition in Business Rule should evaluate to true for your test case
   assigned_to changes AND assigned_to == 'AG01_arch'
   
   // Test: Open a story, change assigned_to, save
   // If Business Rule is active and condition is true, it should fire
   ```

3. **Verify REST Message / Outbound Integration**
   - In ServiceNow: Integrations > Outbound > REST Message
   - Check endpoint URL is exactly correct
   - Test the REST Message manually:
     - Open REST Message
     - Click "Test" function
     - Provide sample payload
     - Should get success response

4. **Verify n8n webhook URL**
   - In n8n, open the webhook node
   - Copy the full webhook URL
   - It should match what's in the ServiceNow REST Message
   - Test with curl:
     ```bash
     curl -X POST https://your-n8n.com/webhook/arch-jr-main \
       -H "Content-Type: application/json" \
       -d '{"test": "payload"}'
     ```

5. **Check authentication**
   - If webhook requires auth token, ensure ServiceNow is sending it in headers
   - Verify token matches what n8n expects

**Solution**: 
- If webhook URL is wrong, update REST Message endpoint
- If condition never matches, debug with ServiceNow logs or test with always-true condition temporarily
- If REST Message fails, check ServiceNow network/proxy settings

---

### 2. Spec Generated But Not Written to ServiceNow

**Symptom**: n8n workflow completes successfully, but `technical_specification` field stays empty.

**Check List**:

1. **Verify service account has write permission**
   ```
   In ServiceNow: System Security > Roles > ag01_arch_writer
   Check ACL: story table, write, field: technical_specification
   ```

2. **Check story field exists**
   ```
   In ServiceNow: System Definition > Tables > Story
   Fields section should list "technical_specification"
   If not, create it (see servicenow/SETUP.md Step 2)
   ```

3. **Check n8n write-back node output**
   - Open the workflow execution logs
   - Look at "ServiceNow Update Record" node
   - Should show response like `{ "success": true, "sys_id": "..." }`
   - If it shows an error, the issue is there

4. **Verify field name exactly**
   - In n8n: Field name should be `technical_specification` (not `technicalSpecification` or `Technical Specification`)
   - Case matters in ServiceNow API

5. **Check response mapping**
   - In n8n write-back node, mapping should be:
     - Source: `{{ $json.claude_response.content[0].text }}`
     - Destination field: `technical_specification`

**Solution**:
- If permission missing, add ACL rule to service account role
- If field doesn't exist, create it in ServiceNow
- If node is failing, check error message and fix mapping/field name
- Test write separately in n8n: Create a dummy story, try to update manually

---

### 3. Claude API Call Fails

**Symptom**: n8n workflow fails at Claude HTTP request node with error about authentication or bad request.

**Check List**:

1. **Verify API key is correct**
   ```
   In n8n: Settings > Credentials > Anthropic API
   Credential should contain your actual key from https://console.anthropic.com
   Test with curl:
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: sk-ant-your-key-here" \
     -H "anthropic-version: 2023-06-01" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-opus-5","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
   ```

2. **Check request format**
   - Model should be: `claude-opus-5` (not `claude-3-opus` or other variant)
   - max_tokens should be reasonable (1000-4000)
   - messages array should have at least one message
   - system prompt should be in separate `system` field

3. **Check token usage**
   - If error says "rate limited" or "quota exceeded", you've hit usage limits
   - Check Anthropic dashboard for current usage
   - May need to adjust prompts to use fewer tokens

4. **Verify prompt is valid**
   - If the prompt has broken formatting or special characters, API might reject it
   - Check n8n logs for exact request body being sent
   - Ensure newlines and quotes are properly escaped in JSON

5. **Check API response**
   - Look at actual error message in n8n execution logs
   - Copy the full error and search Anthropic docs

**Solution**:
- If API key wrong, update credential with correct key
- If request format wrong, fix the HTTP request node configuration
- If rate limited, wait and retry, or optimize prompts to use fewer tokens
- If prompt invalid, validate JSON before sending

---

### 4. Context Gathering Returns Empty/Null

**Symptom**: Workflow runs but context nodes return no data, resulting in spec with "no context found" message.

**Check List**:

1. **Verify ServiceNow credentials**
   ```
   In n8n: Settings > Credentials > ServiceNow Instance
   Test with curl:
   curl -u username:password \
     https://your-instance.service-now.com/api/now/table/story?sysparm_limit=1
   ```

2. **Check ServiceNow queries are correct**
   - Project context query: Filter by `related_to = <project_sys_id>`
   - Knowledge articles query: Filter by `article = true OR related_to = <project_sys_id>`
   - Module entitlements query: Filter by `active = true`
   
   Test these in ServiceNow directly:
   - Navigate to table (e.g., kb_knowledge)
   - Run the filter manually
   - If empty, the query is wrong or data doesn't exist

3. **Verify payload contains required IDs**
   - Webhook payload should have `project` and `sys_id` fields
   - These are used in context queries
   - If missing, payload structure from ServiceNow Business Rule is wrong

4. **Check table/field names**
   - Are you querying the right tables? (kb_knowledge vs kb_article, etc.)
   - Field names case-sensitive in ServiceNow API
   - Verify in ServiceNow's API Explorer

5. **Increase timeout**
   - If queries are slow, n8n might timeout
   - In n8n config, increase request timeout from 30s to 60s
   - Check network latency to ServiceNow instance

**Solution**:
- Test ServiceNow credentials independently
- Run queries in ServiceNow UI to verify they return data
- Fix filter conditions to match your data structure
- If no data exists, seed test data (create knowledge articles, active plugins, etc.)

---

### 5. Workflow Times Out

**Symptom**: n8n workflow runs for >60 seconds and times out, or completes but very slowly.

**Check List**:

1. **Profile each node**
   - n8n shows execution time per node
   - Identify which node is slow (usually a ServiceNow query or Claude API call)

2. **ServiceNow query too large**
   - If querying many records, add limit: `sysparm_limit=50`
   - Use filters to narrow results
   - Check if table has proper indexes

3. **Claude API slow**
   - Check Anthropic API status page
   - Very large contexts can take longer to process
   - Consider reducing context size (fewer precedent specs, blueprint sections only)

4. **Network latency**
   - Your n8n instance to ServiceNow: should be <2-3s per query
   - If seeing 10s+ per query, check network/proxy

5. **Too many parallel operations**
   - If all 4 context branches + Claude + write-back are slow, may need optimization
   - Can you cache design principles (doesn't change per story)?

**Solution**:
- Add `sysparm_limit` to queries to reduce data volume
- Cache static data (design principles, active plugins list)
- Reduce precedent specs included (use most recent 5-10 instead of all)
- If blueprint is large, retrieve only relevant sections
- Monitor and optimize specific slow nodes

---

### 6. Spec Quality Is Poor or Off-Topic

**Symptom**: Generated spec doesn't accurately address the requirement, or makes strange assumptions.

**Check List**:

1. **Review the context**
   - Check n8n execution logs to see what context was actually passed to Claude
   - Was project context empty?
   - Were precedent specs included?
   - Was blueprint correct?

2. **Check story input quality**
   - Is the story's short_description and description clear?
   - Are acceptance criteria specific?
   - If story is vague, spec will be vague

3. **Review Design Principles**
   - Is the design principles document accurate?
   - Is Claude following those principles?

4. **Check system prompt**
   - Is the system prompt from `prompts/spec-generation.md` being used?
   - Or is it truncated/corrupted?

5. **Check Claude model**
   - Verify you're using `claude-opus-5`, not a smaller model
   - Verify in n8n HTTP request: `"model": "claude-opus-5"`

6. **Gather feedback**
   - Have a developer review the spec
   - What's wrong? (Too vague? Wrong assumptions? Missing details?)
   - This feedback helps tune the prompt

**Solution**:
- Improve story quality (better descriptions, acceptance criteria)
- Review context being passed - if empty, fix context gathering
- Check that Design Principles are accurate and passed to Claude
- If multiple specs are poor in same way, adjust system prompt
- See `prompts/spec-generation.md` for customization points

---

### 7. Blueprint Not Updating

**Symptom**: Story is closed with a spec, but blueprint article doesn't get updated.

**Check List**:

1. **Verify blueprint update trigger**
   - Business Rule on Story table: condition should be `technical_specification is not empty AND state changes to Closed/Complete`
   - Test: Close a story that has a spec
   - Check n8n webhook for the blueprint update call

2. **Check blueprint article exists**
   - For each project, should have a knowledge article titled `[Project Name] Blueprint`
   - sys_id should be discoverable via query `title = "*Blueprint"` AND `category = "Technical Blueprints"`

3. **Verify n8n blueprint workflow**
   - Open workflow: `Arch Jr - Update Project Blueprint`
   - Check if it's active (toggle switch)
   - Test webhook manually

4. **Check blueprint write-back**
   - In n8n logs, look for "ServiceNow Update Record" on kb_knowledge table
   - Should succeed with response showing updated article
   - If failing, likely permission or article not found

5. **Verify service account has write access**
   - Service account needs write on kb_knowledge table
   - Check ACL for this role

**Solution**:
- Ensure both Business Rules are active (spec generation AND blueprint update)
- Ensure blueprint articles exist for your projects
- Test blueprint update workflow separately with a test story
- Check service account has write access to kb_knowledge table

---

### 8. High Costs / Token Usage

**Symptom**: Claude API costs are higher than expected, or token counts seem excessive.

**Check List**:

1. **Monitor token usage**
   - Check Anthropic dashboard for actual tokens used
   - n8n logs should show token counts per request
   - Track input vs output tokens

2. **Review context size**
   - How many precedent specs are you including? (Each: ~200-300 tokens)
   - Is blueprint being passed in full? (Could be 1000-3000 tokens)
   - Are attachments being text-extracted? (Large attachments = many tokens)

3. **Check spec length**
   - Output specs should be 1500-3000 tokens typically
   - If >3500, Claude is being very verbose
   - Consider shorter prompts or lower max_tokens limit

4. **Model comparison**
   - Claude Opus 5: $15/$45 per 1M in/out tokens
   - Claude Sonnet 5: $3/$15 per 1M in/out tokens
   - If cost is issue, consider Sonnet for simpler specs

**Solution**:
- Limit precedent specs to most recent 5-10 (not all)
- Retrieve blueprint sections instead of full document
- Reduce max_tokens from 4000 to 3000 if specs are still good quality
- Consider using Claude Sonnet for some stories (simpler features)
- Optimize prompts to be more concise

---

### 9. ServiceNow API Errors (400, 403, 404)

**Symptom**: n8n ServiceNow nodes fail with HTTP errors.

**HTTP 400 (Bad Request)**
- Query syntax wrong
- Field name misspelled
- Table doesn't exist
- **Fix**: Double-check field/table names in ServiceNow API Explorer

**HTTP 403 (Forbidden)**
- Service account doesn't have read/write permission
- ACL blocking the operation
- **Fix**: Check role has appropriate ACLs, see servicenow/SETUP.md

**HTTP 404 (Not Found)**
- Record doesn't exist
- Wrong endpoint URL
- **Fix**: Verify the record exists in ServiceNow, check URL format

**HTTP 429 (Rate Limited)**
- Too many requests to ServiceNow in short time
- **Fix**: Add delays between parallel requests, or contact ServiceNow admin about rate limits

**Solution**:
- Test the API call in ServiceNow's API Explorer first
- Verify credentials and permissions
- Check URL format matches ServiceNow API docs
- If hitting rate limits, reduce concurrency or add delays

---

### 10. Spec Includes Unlicensed Modules

**Symptom**: Generated spec recommends a module/plugin that's not active in your instance.

**Check List**:

1. **Verify MODULE_ENTITLEMENTS being passed to Claude**
   - Are you fetching `sys_plugins` table with `active = true`?
   - Is the list being included in the prompt?

2. **Check static license doc**
   - Are you passing the static license doc that lists contractual caps?
   - Does it mention which modules are licensed?

3. **Review spec output**
   - Should have section "Assumptions & Flags"
   - Should say "MODULE X not licensed - using alternative MODULE Y instead"
   - If spec proposes unlicensed module without flagging, prompt needs adjustment

**Solution**:
- Ensure module entitlements are being queried correctly in context gathering
- Pass complete list of active plugins + static license doc to Claude
- Review `prompts/spec-generation.md` rule: "Only propose solutions using confirmed active modules"
- If rule not being followed, adjust system prompt clarity

---

## Debug Workflow in n8n

**To troubleshoot n8n workflows**:

1. Open the workflow execution
2. Click on each node to see:
   - **Input**: What data went into the node
   - **Output**: What the node produced
   - **Logs**: Any error messages
3. Use "Expression Editor" to inspect variables
4. Click "Execute Node" to test a single node with sample data

**Enable debug mode**:
- In n8n, enable "Debug" setting
- Logs will show more detail
- Performance will be slower, disable after troubleshooting

---

## Getting Help

If you're stuck:

1. **Check this guide** for your specific symptom
2. **Enable debug mode** and capture full logs
3. **Test components in isolation**:
   - Test ServiceNow API with curl
   - Test Claude API with curl
   - Test each n8n node separately
4. **Check logs**:
   - n8n execution logs
   - ServiceNow system logs (System Logs > All Logs)
   - Anthropic API logs (console.anthropic.com)
5. **Consult documentation**:
   - n8n docs: https://docs.n8n.io
   - ServiceNow docs: https://docs.servicenow.com
   - Anthropic docs: https://docs.anthropic.com

---

## Performance Optimization Checklist

After troubleshooting, optimize for speed and cost:

- [ ] Context gathering runs in parallel (all 4 branches together)
- [ ] Precedent specs limited to most recent 5-10
- [ ] Blueprint retrieved as sections only (not full document)
- [ ] ServiceNow queries have `sysparm_limit` set
- [ ] Design principles cached (don't re-fetch per story)
- [ ] Claude token limit set to 3000-4000 (not higher)
- [ ] Temperature set to 0 (deterministic)
- [ ] Error handling configured (no infinite retries)
- [ ] Monitoring alerts set for failures
