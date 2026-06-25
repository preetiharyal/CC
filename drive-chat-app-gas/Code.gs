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

function getDocuments() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('drive_content');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('Cache parse error, re-fetching: ' + e.message);
    }
  }

  var props = PropertiesService.getScriptProperties();
  var folderIdsRaw = props.getProperty('FOLDER_IDS') || '';
  var folderIds = folderIdsRaw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);

  var docs = [];

  folderIds.forEach(function(folderId) {
    collectFromFolder(folderId, docs);
  });

  // CacheService has a 100KB limit per entry; store what fits
  var serialized = JSON.stringify(docs);
  try {
    // Max cache value size is 100KB; truncate if needed
    if (serialized.length <= 100000) {
      cache.put('drive_content', serialized, 21600); // 6 hours
    } else {
      Logger.log('Result too large for cache (' + serialized.length + ' chars), skipping cache.');
    }
  } catch (cacheErr) {
    Logger.log('Cache write error: ' + cacheErr.message);
  }

  return docs;
}

function collectFromFolder(folderId, docs) {
  // Shared drive roots (IDs starting with "0A") need corpora:'drive' instead of parent query
  var isSharedDriveRoot = folderId.indexOf('0A') === 0;
  if (isSharedDriveRoot) {
    listSharedDriveContents(folderId, docs);
  } else {
    listFilesRecursiveById(folderId, docs);
  }
}

// For shared drive roots: list all files in the drive
function listSharedDriveContents(driveId, docs) {
  var pageToken = null;
  do {
    var params = {
      corpora: 'drive',
      driveId: driveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: 'trashed = false',
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100
    };
    if (pageToken) params.pageToken = pageToken;

    var response;
    try {
      response = Drive.Files.list(params);
    } catch (err) {
      Logger.log('Shared drive list error for ' + driveId + ': ' + err.message);
      return;
    }

    var items = response.files || [];
    Logger.log('Shared drive ' + driveId + ': found ' + items.length + ' items');
    items.forEach(function(item) {
      if (item.mimeType !== 'application/vnd.google-apps.folder') {
        try {
          var file = DriveApp.getFileById(item.id);
          var doc = extractFileContent(file);
          if (doc) docs.push(doc);
        } catch (e) {
          Logger.log('Could not open file ' + item.name + ': ' + e.message);
        }
      }
    });

    pageToken = response.nextPageToken;
  } while (pageToken);
}

// Uses Advanced Drive Service (Drive API v3) to support shared drives
function listFilesRecursiveById(folderId, docs) {
  var pageToken = null;
  do {
    var params = {
      q: '"' + folderId + '" in parents and trashed = false',
      fields: 'nextPageToken, files(id, name, mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 100
    };
    if (pageToken) params.pageToken = pageToken;

    var response;
    try {
      response = Drive.Files.list(params);
    } catch (err) {
      Logger.log('Drive.Files.list error for folder ' + folderId + ': ' + err.message);
      return;
    }

    var items = response.files || [];
    items.forEach(function(item) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        listFilesRecursiveById(item.id, docs);
      } else {
        try {
          var file = DriveApp.getFileById(item.id);
          var doc = extractFileContent(file);
          if (doc) docs.push(doc);
        } catch (e) {
          Logger.log('Could not open file ' + item.name + ': ' + e.message);
        }
      }
    });

    pageToken = response.nextPageToken;
  } while (pageToken);
}

function listFilesRecursive(folder, docs) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var doc = extractFileContent(file);
    if (doc) {
      docs.push(doc);
    }
  }

  var subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    listFilesRecursive(subFolders.next(), docs);
  }
}

function extractFileContent(file) {
  var id = file.getId();
  var name = file.getName();
  var mimeType = file.getMimeType();
  var content = '';

  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      content = DocumentApp.openById(id).getBody().getText();

    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      var ss = SpreadsheetApp.openById(id);
      var sheets = ss.getSheets();
      var parts = [];
      for (var i = 0; i < sheets.length; i++) {
        var sheetName = sheets[i].getName();
        var values = sheets[i].getDataRange().getValues();
        var rows = values.map(function(row) {
          return row.join('\t');
        });
        parts.push('Sheet: ' + sheetName + '\n' + rows.join('\n'));
      }
      content = parts.join('\n\n');

    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      var pres = SlidesApp.openById(id);
      var slides = pres.getSlides();
      var slideParts = [];
      for (var s = 0; s < slides.length; s++) {
        var slideText = [];
        var shapes = slides[s].getShapes();
        for (var sh = 0; sh < shapes.length; sh++) {
          try {
            var text = shapes[sh].getText().asString().trim();
            if (text) {
              slideText.push(text);
            }
          } catch (shErr) {
            // Shape has no text, skip
          }
        }
        if (slideText.length > 0) {
          slideParts.push('Slide ' + (s + 1) + ':\n' + slideText.join('\n'));
        }
      }
      content = slideParts.join('\n\n');

    } else if (mimeType === 'application/vnd.google-apps.form') {
      Logger.log('Skipping Google Form: ' + name);
      return null;

    } else if (mimeType === 'application/pdf') {
      Logger.log('Skipping PDF (binary, not parseable in GAS): ' + name);
      return null;

    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.ms-powerpoint'
    ) {
      Logger.log('Skipping uploaded Office file (binary, not parseable in GAS): ' + name);
      return null;

    } else {
      // Unknown/unsupported type
      Logger.log('Skipping unsupported file type ' + mimeType + ': ' + name);
      return null;
    }
  } catch (err) {
    Logger.log('Error extracting content from "' + name + '" (' + mimeType + '): ' + err.message);
    return null;
  }

  if (!content || !content.trim()) {
    Logger.log('Empty content for: ' + name);
    return null;
  }

  return {
    id: id,
    name: name,
    mimeType: mimeType,
    content: content.trim(),
    charCount: content.length
  };
}

// --------------- Chat ---------------------------------------

function chat(userMessage, history) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured in Script Properties');
  }

  var docs = getDocuments();

  // Build document context
  var docSections = docs.map(function(doc) {
    return '--- FILE: ' + doc.name + ' ---\n' + doc.content;
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

  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
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
  var cache = CacheService.getScriptCache();
  cache.remove('drive_content');
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
