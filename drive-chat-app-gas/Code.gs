// ============================================================
// Drive Knowledge Base — Google Apps Script backend
// ============================================================

// --------------- Diagnostics (run this from the editor to debug) ----

function diagnose() {
  var props = PropertiesService.getScriptProperties();
  var folderIdsRaw = props.getProperty('FOLDER_IDS') || '';
  Logger.log('FOLDER_IDS value: "' + folderIdsRaw + '"');

  var folderIds = folderIdsRaw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  Logger.log('Parsed folder IDs: ' + JSON.stringify(folderIds));

  folderIds.forEach(function(folderId) {
    Logger.log('--- Testing folder: ' + folderId);

    // Test 1: DriveApp
    try {
      var folder = DriveApp.getFolderById(folderId);
      Logger.log('DriveApp.getFolderById OK: ' + folder.getName());
    } catch (e) {
      Logger.log('DriveApp.getFolderById FAILED: ' + e.message);
    }

    // Test 2: Advanced Drive Service
    try {
      var result = Drive.Files.list({
        q: '"' + folderId + '" in parents and trashed = false',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 5,
        fields: 'files(id, name, mimeType)'
      });
      var files = result.files || [];
      Logger.log('Drive.Files.list OK — found ' + files.length + ' items (first 5):');
      files.forEach(function(f) {
        Logger.log('  ' + f.name + ' [' + f.mimeType + ']');
      });
    } catch (e) {
      Logger.log('Drive.Files.list FAILED: ' + e.message);
    }
  });

  Logger.log('--- Done. Check logs above for errors.');
}

// --------------- Entry point --------------------------------

function doGet(e) {
  if (!isUserAllowed()) {
    var email = Session.getActiveUser().getEmail();
    var page = HtmlService.createHtmlOutputFromFile('login');
    page.setTitle('Access Denied — Drive Knowledge Base');
    // Pass email into the page via a simple token replacement
    var html = page.getContent().replace('{{USER_EMAIL}}', email);
    return HtmlService.createHtmlOutput(html)
      .setTitle('Access Denied — Drive Knowledge Base')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Drive Knowledge Base')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// --------------- Access control -----------------------------

function isUserAllowed() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('ALLOWLIST_SHEET_ID');

  // If no allowlist configured, allow everyone
  if (!sheetId) {
    return true;
  }

  var userEmail = Session.getActiveUser().getEmail().toLowerCase().trim();
  if (!userEmail) {
    return false;
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];
    var values = sheet.getRange('A:A').getValues();
    for (var i = 0; i < values.length; i++) {
      var cellVal = String(values[i][0]).toLowerCase().trim();
      if (cellVal === userEmail) {
        return true;
      }
    }
    return false;
  } catch (err) {
    Logger.log('isUserAllowed error: ' + err.message);
    // On error reading the sheet, deny access to be safe
    return false;
  }
}

// --------------- Document loading ---------------------------

// Fast: just lists file metadata. Content is fetched lazily in chat().
function getDocuments() {
  var cache = CacheService.getUserCache();
  var cached = cache.get('drive_file_list');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var props = PropertiesService.getScriptProperties();
  var folderIdsRaw = props.getProperty('FOLDER_IDS') || '';
  var folderIds = folderIdsRaw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);

  var files = [];
  folderIds.forEach(function(folderId) {
    collectFileList(folderId, files);
  });

  var serialized = JSON.stringify(files);
  try {
    if (serialized.length <= 100000) {
      cache.put('drive_file_list', serialized, 21600);
    }
  } catch (e) {}

  return files;
}

function collectFileList(folderId, files) {
  var isSharedDriveRoot = folderId.indexOf('0A') === 0;
  var pageToken = null;
  do {
    var params = isSharedDriveRoot
      ? { corpora: 'drive', driveId: folderId, includeItemsFromAllDrives: true, supportsAllDrives: true, q: 'trashed = false', fields: 'nextPageToken, files(id, name, mimeType)', pageSize: 100 }
      : { q: '"' + folderId + '" in parents and trashed = false', includeItemsFromAllDrives: true, supportsAllDrives: true, fields: 'nextPageToken, files(id, name, mimeType)', pageSize: 100 };
    if (pageToken) params.pageToken = pageToken;

    var response;
    try { response = Drive.Files.list(params); }
    catch (err) { Logger.log('Drive.Files.list error for ' + folderId + ': ' + err.message); return; }

    (response.files || []).forEach(function(item) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        collectFileList(item.id, files);
      } else if (isSupportedType(item.mimeType)) {
        files.push({ id: item.id, name: item.name, mimeType: item.mimeType });
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);
}

function isSupportedType(mimeType) {
  return mimeType === 'application/vnd.google-apps.document' ||
         mimeType === 'application/vnd.google-apps.spreadsheet' ||
         mimeType === 'application/vnd.google-apps.presentation';
}

// Reads and caches content for a single file
function getFileContent(fileId, name, mimeType) {
  var cache = CacheService.getUserCache();
  var cacheKey = 'file_' + fileId;
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  var content = '';
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      content = DocumentApp.openById(fileId).getBody().getText();

    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      var ss = SpreadsheetApp.openById(fileId);
      var parts = ss.getSheets().map(function(sheet) {
        var rows = sheet.getDataRange().getValues().map(function(row) { return row.join('\t'); });
        return 'Sheet: ' + sheet.getName() + '\n' + rows.join('\n');
      });
      content = parts.join('\n\n');

    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      var pres = SlidesApp.openById(fileId);
      var slideParts = [];
      pres.getSlides().forEach(function(slide, i) {
        var texts = [];
        slide.getShapes().forEach(function(shape) {
          try { var t = shape.getText().asString().trim(); if (t) texts.push(t); } catch (e) {}
        });
        if (texts.length) slideParts.push('Slide ' + (i + 1) + ':\n' + texts.join('\n'));
      });
      content = slideParts.join('\n\n');
    }
  } catch (err) {
    Logger.log('Error reading "' + name + '": ' + err.message);
    return null;
  }

  if (!content || !content.trim()) return null;
  content = content.trim();

  // Cache per file (up to 100KB each, 6 hours)
  try {
    if (content.length <= 100000) cache.put(cacheKey, content, 21600);
  } catch (e) {}

  return content;
}

// --------------- Chat ---------------------------------------

function chat(userMessage, history) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured in Script Properties');
  }

  var files = getDocuments();

  // Fetch content for each file (cached per file after first load)
  var docSections = [];
  files.forEach(function(f) {
    var content = getFileContent(f.id, f.name, f.mimeType);
    if (content) docSections.push('--- FILE: ' + f.name + ' ---\n' + content);
  });

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var systemPrompt =
    'You are a helpful assistant with access to documents from a Google Drive knowledge base.\n' +
    'Answer questions based on the document contents provided. If the answer isn\'t in the documents, say so clearly.\n' +
    'Be concise and helpful. Today\'s date is ' + today + '.\n\n' +
    '=== DOCUMENTS ===\n' +
    docSections.join('\n\n');

  // Truncate if over 800,000 chars
  var MAX_CHARS = 800000;
  if (systemPrompt.length > MAX_CHARS) {
    var header =
      'You are a helpful assistant with access to documents from a Google Drive knowledge base.\n' +
      'Answer questions based on the document contents provided. If the answer isn\'t in the documents, say so clearly.\n' +
      'Be concise and helpful. Today\'s date is ' + today + '.\n\n' +
      'NOTE: The document set was too large to include in full. Some documents were omitted.\n\n' +
      '=== DOCUMENTS ===\n';
    var remaining = MAX_CHARS - header.length;
    var truncated = [];
    var used = 0;
    for (var i = 0; i < docSections.length; i++) {
      var section = docSections[i] + '\n\n';
      if (used + section.length > remaining) {
        break;
      }
      truncated.push(docSections[i]);
      used += section.length;
    }
    systemPrompt = header + truncated.join('\n\n');
  }

  // Build messages array
  var messages = [];
  if (history && Array.isArray(history)) {
    for (var h = 0; h < history.length; h++) {
      var turn = history[h];
      if (turn && turn.role && turn.content) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }
  messages.push({ role: 'user', content: userMessage });

  // API endpoint and auth header are configurable for proxy wrappers (e.g. Fuelix)
  var apiUrl = props.getProperty('ANTHROPIC_API_URL') || 'https://api.anthropic.com/v1/messages';
  var apiKeyHeader = props.getProperty('ANTHROPIC_API_KEY_HEADER') || 'x-api-key';
  var modelName = props.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';

  var payload = {
    model: modelName,
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages
  };

  var headers = {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  };
  headers[apiKeyHeader] = apiKey;

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var statusCode = response.getResponseCode();
  var body = response.getContentText();

  if (statusCode !== 200) {
    throw new Error('Anthropic API error ' + statusCode + ': ' + body);
  }

  var json = JSON.parse(body);
  return json.content[0].text;
}

// --------------- Utilities ----------------------------------

function reloadCache() {
  var cache = CacheService.getUserCache();
  // Clear file list; per-file content caches expire naturally or on next load
  cache.remove('drive_file_list');
  return 'Cache cleared. Documents will reload on next request.';
}

function getStatus() {
  var props = PropertiesService.getScriptProperties();
  var userEmail = Session.getActiveUser().getEmail();
  var allowed = isUserAllowed();
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  var folderIdsRaw = props.getProperty('FOLDER_IDS') || '';
  var folderIds = folderIdsRaw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  return {
    userEmail: userEmail,
    isAllowed: allowed,
    anthropicConfigured: !!apiKey,
    folderIds: folderIds
  };
}
