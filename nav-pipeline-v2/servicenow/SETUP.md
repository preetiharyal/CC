# ServiceNow Configuration Setup

## Prerequisites

- ServiceNow instance with scoped app access
- Service account with appropriate role (e.g., `admin` or custom role with Story table write access)
- Custom field `technical_specification` added to Story table

## Step 1: Create Service Account & Role

### 1.1 Create Service Account User

In ServiceNow admin:
1. Navigate to **System Security > Users**
2. Create new user:
   - **User ID**: `AG01_arch` (or your preference)
   - **First name**: `AG01`
   - **Last name**: `Architect`
   - **Email**: `ag01-arch@yourcompany.com`
3. Assign role that allows:
   - Read on all required tables (Story, Project, Knowledge Article, etc.)
   - Write on Story table's `technical_specification` field only
   - Read on sys_plugins (for module entitlements)
   - Read on sys_attachment

### 1.2 Create or Use Existing Role

If creating a custom role (recommended for least privilege):
1. Navigate to **System Security > Roles**
2. Create new role: `ag01_arch_writer`
3. Add ACLs:
   ```
   Table: story, Operation: read, All fields
   Table: story, Operation: write, Field: technical_specification only
   Table: project, Operation: read, All fields
   Table: kb_knowledge, Operation: read, All fields
   Table: sys_attachment, Operation: read, All fields
   Table: sys_plugins, Operation: read, All fields
   Table: cmdb_ci_service, Operation: read, All fields
   ```

## Step 2: Add Custom Field to Story Table

If `technical_specification` field doesn't exist:

1. Navigate to **System Definition > Tables**
2. Open **Story** table
3. Click **New Field**:
   - **Label**: `Technical Specification`
   - **Name**: `technical_specification`
   - **Type**: `Text (Large)` or `Journal Entry`
   - **Read Role**: agent role
   - **Write Role**: `ag01_arch_writer` role only

## Step 3: Create Business Rules

### 3.1 Main Specification Trigger

Create Business Rule for spec generation when story assigned to agent:

**Name**: `Arch Jr - Generate Spec on Assignment`

**Table**: Story

**When**: After

**Insert/Update**: Yes

**Condition**:
```javascript
// Fire when assigned_to changes to the AG01_arch agent account
(gs.getValue('table.story.assigned_to') === 'AG01_arch') &&
(!gs.isFirstTime('assigned_to') || gs.getValue('assigned_to') !== gs.getOldValue('assigned_to'))
```

**Action**: Execute REST Outbound Integration

- **REST Message**: Create new or use existing REST Message
- **Function**: POST to `https://your-n8n-instance.com/webhook/arch-jr-main`
- **Payload** (JSON):
```json
{
  "sys_id": "${sys_id}",
  "number": "${number}",
  "short_description": "${short_description}",
  "description": "${description}",
  "acceptance_criteria": "${acceptance_criteria}",
  "parent": "${parent}",
  "project": "${project}",
  "assigned_to": "${assigned_to}",
  "timestamp": "${gs.nowUTC()}"
}
```

**Important**: Ensure this Business Rule runs as the service account or uses a REST Message with proper authentication.

### 3.2 Blueprint Update Trigger

Create Business Rule for blueprint extraction when story is closed:

**Name**: `Arch Jr - Update Blueprint on Story Close`

**Table**: Story

**When**: After

**Insert/Update**: Yes

**Condition**:
```javascript
// Fire when state changes to closed/complete AND technical_specification is populated
!gs.isFirstTime('state') && 
current.state.changes() && 
(current.state === 'closed' || current.state === 'complete') &&
current.technical_specification !== ''
```

**Action**: Execute REST Outbound Integration

- **REST Message**: Similar to above or reuse
- **Function**: POST to `https://your-n8n-instance.com/webhook/arch-jr-blueprint-update`
- **Payload** (JSON):
```json
{
  "sys_id": "${sys_id}",
  "number": "${number}",
  "state": "${state}",
  "technical_specification": "${technical_specification}",
  "project": "${project}",
  "timestamp": "${gs.nowUTC()}"
}
```

## Step 4: Create Knowledge Article Template for Blueprints

Create a Knowledge Article Category/Template for project blueprints:

1. Navigate to **Knowledge > Articles**
2. Create new article (or use existing category):
   - **Category**: `Technical Blueprints` (or `Project Blueprints`)
   - **Knowledge Base**: (choose appropriate)
   
3. For each new project, create an article with name:
   - **Title**: `[Project Name] Blueprint`
   - **Short Description**: `Technical blueprint and architecture for [Project Name]`
   - **Content**: Use the template below

**Blueprint Template** (save as starting content):
```markdown
# [Project Name] Blueprint

Last Updated: (Story Number) - (Date)

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
```

## Step 5: Configure REST Message for Webhooks

In ServiceNow:

1. Navigate to **Integrations > Outbound > REST Message**
2. Create new REST Message:
   - **Name**: `Arch Jr - Main Webhook`
   - **Endpoint**: `https://your-n8n-instance.com/webhook/arch-jr-main`
   - **HTTP Method**: POST
   - **Authentication**: Basic Auth (if needed) or Headers
   - **Headers**:
     - `Content-Type: application/json`
     - `Authorization: Bearer <n8n_webhook_token>` (if required)

3. Create function to call from Business Rule

## Step 6: Test Configuration

1. **Verify service account exists**: System Security > Users > Search for `AG01_arch`
2. **Verify custom field exists**: System Definition > Tables > Story > Fields > Find `technical_specification`
3. **Verify Business Rules exist**: System Policy > Business Rules (search for "Arch Jr")
4. **Test REST Message**: Open the REST Message, click "Test" with sample payload

## Step 7: Security Considerations

- ✅ Service account has minimal necessary permissions
- ✅ Only `technical_specification` field is writable by agent
- ✅ Webhooks protected with authentication tokens
- ✅ Audit trail records all automated updates
- ✅ Developer approval required before spec is written to the story

## Troubleshooting

**Business Rule not firing?**
- Check condition logic in the Business Rule
- Verify service account has execute_business_rules privilege
- Check Execution History for the Business Rule

**REST Message failing?**
- Verify endpoint URL is correct
- Check n8n webhook is active
- Verify authentication tokens in headers

**Story updates not appearing?**
- Check transaction logs in ServiceNow
- Verify user has write access to `technical_specification` field
- Check if Business Rule is flagged as inactive

## Next Steps

1. Follow `./n8n/SETUP.md` to deploy n8n workflows
2. Test end-to-end in `../TESTING.md`
