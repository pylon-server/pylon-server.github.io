/* AppUI loader — authoritative bundle definitions for framework/bundler.py.
 *
 * Usage:
 *   <script src="/appui/loader.js"></script>
 *   <script>window.AppUIReady = AppUIAssets.load('foundation', 'shell');</script>
 *
 * Source files are bundled on demand; keep each bundle's dependency order here.
 */
window.AppUIAssets = window.AppUIAssets || {};

(function() {
  var loaded = window.AppUIAssets.loaded || new Map();
  var _loadedFiles = new Set();
  var _filePromises = new Map();
  var _modulePromises = new Map();
  var _moduleRetries = new Map();
  var _loadedModules = new Set();
  var _loadedStyles = new Set();
  var _stylePromises = new Map();
  var _preloadedBundles = new Set();
  var _loadEvents = [];
  function recordLoad(event) {
    _loadEvents.push(event);
    if (_loadEvents.length > 200) _loadEvents.splice(0, _loadEvents.length - 200);
  }
  var _assetVersion = window.APPUI_ASSET_VERSION || (document.currentScript ? new URL(document.currentScript.src, location.href).searchParams.get('v') : '');
  function versioned(url) {
    // The gateway rewrites this root along with the bundle URLs. Its length
    // must follow that rewrite too (a fixed seven corrupts prefixed paths).
    var appuiRoot = '/appui/';
    if (window.APPUI_BASE && url.indexOf(appuiRoot) === 0) {
      url = window.APPUI_BASE.replace(/\/$/, '') + '/' + url.slice(appuiRoot.length);
    }
    if (window.PYLON_STATIC_BASE && url.indexOf('/dependencies/') === 0) url = window.PYLON_STATIC_BASE + url;
    // Fall back to the build-stamped content-hash version (_fwVersion, defined in
    // the auto-generated block below) so a bare `/appui/loader.js` — the way
    // every page loads it — still cache-busts /appui/src/* whenever the shipped
    // appui code changes. Without this, those URLs were served unversioned and
    // the browser cached them indefinitely (appui edits never reached users).
    var v = _assetVersion || (typeof _fwVersion !== 'undefined' ? _fwVersion : '');
    return v ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(v) : url;
  }

  /* Bundle definitions — also read by the server-side bundler. */
  /* BUNDLES_START */
  var _fwVersion = '785cc6ddb4ffba20';
  var _bundleDefs = {
    'foundationCore': [
      '/appui/src/foundation/storage.js',
      '/appui/src/foundation/theme.js',
      '/dependencies/marked/marked.min.js',
      '/appui/src/runtime/markdown.js',
      '/appui/src/runtime/stream-events.js',
      '/appui/src/runtime/core-stream.js',
      '/appui/src/runtime/core-steering.js',
      '/appui/src/runtime/core.js',
      '/appui/src/runtime/text-utils.js',
      '/appui/src/runtime/file-utils.js',
      '/appui/src/runtime/async-cache.js',
      '/appui/src/runtime/script-loader.js',
      '/appui/src/runtime/lazy-feature.js',
      '/appui/src/runtime/document-styles.js',
      '/appui/src/runtime/document-layout.js',
      '/appui/src/runtime/poll-refresh.js',
      '/appui/src/runtime/state.js',
      '/appui/src/runtime/reactive-state.js',
      '/appui/src/runtime/config-cache.js',
      '/appui/src/foundation/lifecycle.js',
      '/appui/src/foundation/host-hooks.js',
      '/appui/src/foundation/selection-bus.js',
      '/appui/src/foundation/pointer.js',
      '/appui/src/foundation/api.js',
      '/appui/src/foundation/logging.js',
      '/appui/src/foundation/events.js'
    ],
    'dialog': [
      '/appui/src/components/dialog-drag.js',
      '/appui/src/components/dialog-forms.js',
      '/appui/src/components/dialog-job.js',
      '/appui/src/components/dialog-view.js',
      '/appui/src/components/dialog.js'
    ],
    'foundation': [
      '/appui/src/components/tabs-binding.js',
      '/appui/src/services/debug.js',
      '/appui/src/services/workspace-nav.js',
      '/appui/src/components/tabbed-dialog.js',
      '/appui/src/components/toast.js',
      '/appui/src/components/disclosure.js',
      '/appui/src/components/copy-button.js',
      '/appui/src/components/row-filter.js',
      '/appui/src/components/content-accordion.js',
      '/appui/src/components/content-renderer.js',
      '/appui/src/components/content.js',
      '/appui/src/components/preview-table.js',
      '/appui/src/template/contract.js',
      '/appui/src/foundation/layout-state.js',
      '/appui/src/foundation/router-bindings.js',
      '/appui/src/foundation/router.js',
      '/appui/src/foundation/commands.js',
      '/appui/src/foundation/shortcuts.js'
    ],
    'shell': [
      '/appui/src/regions/content.js',
      '/appui/src/regions/menubar.js',
      '/appui/src/regions/sidebar.js',
      '/appui/src/regions/statusbar.js',
      '/appui/src/shell/runtime/helpers.js',
      '/appui/src/shell/runtime/command-runtime.js',
      '/appui/src/shell/runtime/state.js',
      '/appui/src/shell/runtime/ui-adapters.js',
      '/appui/src/shell/runtime/data-cache.js',
      '/appui/src/components/sidebar-tab-overflow.js',
      '/appui/src/components/sidebar-tabs-view.js',
      '/appui/src/components/sidebar-tabs.js',
      '/appui/src/shell/runtime/sidebar-renderer.js',
      '/appui/src/shell/runtime/status-renderer.js',
      '/appui/src/shell/runtime/palette-renderer.js',
      '/appui/src/shell/runtime/ai-sidebar-renderer.js',
      '/appui/src/shell/runtime/pipeline-loader.js',
      '/appui/src/shell/runtime/mounting.js',
      '/appui/src/shell/runtime/breadcrumb.js',
      '/appui/src/shell/layout.js',
      '/appui/src/shell/toolbar.js',
      '/appui/src/shell/routes.js',
      '/appui/src/shell/responsive.js',
      '/appui/src/shell/app-layout.js',
      '/appui/src/shell/app-commands.js',
      '/appui/src/shell/app.js',
      '/appui/src/index.js',
      '/appui/src/shell/runtime/prompt-banner-view.js',
      '/appui/src/shell/runtime/prompt-banner.js',
      '/appui/src/shell/runtime/theme-toggle.js'
    ],
    'templateBootstrap': [
      '/appui/src/template/error-boundary.js',
      '/appui/src/template/bootstrap.js'
    ],
    'logView': [
      '/appui/src/components/log-view.js'
    ],
    'toolbar': [
      '/appui/src/components/toolbar-items.js',
      '/appui/src/components/toolbar.js'
    ],
    'navigationLinks': [
      '/appui/src/components/navigation-link.js'
    ],
    'chatView': [
      '/appui/src/components/chat-view.js'
    ],
    'screencastViewer': [
      '/appui/src/components/screencast-viewer.js'
    ],
    'chatSurface': [
      '/appui/src/content/chat-tools.js',
      '/appui/src/content/chat-stream.js',
      '/appui/src/content/chat-prompt-store.js',
      '/appui/src/content/chat-memory.js',
      '/appui/src/content/chat-ui.js',
      '/appui/src/content/chat-prompts.js',
      '/appui/src/content/chat-records.js',
      '/appui/src/content/chat-storage.js',
      '/appui/src/content/chat-sessions.js',
      '/appui/src/content/chat-stream-view.js',
      '/appui/src/content/chat-history-view.js',
      '/appui/src/content/chat.js',
      '/appui/src/content/chat-surface-styles.js',
      '/appui/src/content/chat-surface-tools.js',
      '/appui/src/content/chat-surface-prompts.js',
      '/appui/src/content/chat-surface-config.js',
      '/appui/src/content/chat-surface-context.js',
      '/appui/src/content/chat-surface-request.js',
      '/appui/src/content/chat-surface-backends.js',
      '/appui/src/content/chat-surface-attachments.js',
      '/appui/src/content/chat-surface-jobs.js',
      '/appui/src/content/chat-surface-history.js',
      '/appui/src/content/chat-surface-location.js',
      '/appui/src/content/chat-surface-preferences.js',
      '/appui/src/content/chat-surface-kiro.js',
      '/appui/src/content/chat-surface-dialogs.js',
      '/appui/src/content/chat-surface-chips.js',
      '/appui/src/content/chat-surface-view.js',
      '/appui/src/content/chat-surface-keyboard.js',
      '/appui/src/content/chat-surface.js'
    ],
    'tabs': [
      '/appui/src/components/tabs-context-menu.js',
      '/appui/src/components/tabs-view.js',
      '/appui/src/components/tabs.js'
    ],
    'pagination': [
      '/appui/src/components/pagination.js'
    ],
    'tree': [
      '/appui/src/components/tree-keyboard.js',
      '/appui/src/components/tree-rendering.js',
      '/appui/src/components/tree-mutations.js',
      '/appui/src/components/tree.js'
    ],
    'sidebarSections': [
      '/appui/src/components/sidebar-sections-view.js',
      '/appui/src/components/sidebar-sections.js'
    ],
    'workspaceComponents': [
      '/appui/src/components/header.js',
      '/appui/src/components/multi-split-model.js',
      '/appui/src/components/multi-split-view.js',
      '/appui/src/components/multi-split-resize.js',
      '/appui/src/components/multi-split.js',
      '/appui/src/components/workspace-view.js',
      '/appui/src/components/workspace.js',
      '/appui/src/components/data-view.js'
    ],
    'aiSidebar': [
      '/appui/src/features/ai-sidebar/usage-tracker-model.js',
      '/appui/src/features/ai-sidebar/usage-tracker.js',
      '/appui/src/features/ai-sidebar/styles.js',
      '/appui/src/features/ai-sidebar/commands.js',
      '/appui/src/features/ai-sidebar/prompts.js',
      '/appui/src/features/ai-sidebar/connections.js',
      '/appui/src/features/ai-sidebar/project-context.js',
      '/appui/src/features/ai-sidebar/catalog.js',
      '/appui/src/features/ai-sidebar/tool-selection.js',
      '/appui/src/features/ai-sidebar/history.js',
      '/appui/src/features/ai-sidebar/context-display.js',
      '/appui/src/features/ai-sidebar/collected-context.js',
      '/appui/src/features/ai-sidebar/tool-controls.js',
      '/appui/src/features/ai-sidebar/workflow-view.js',
      '/appui/src/features/ai-sidebar/header-controls.js',
      '/appui/src/features/ai-sidebar/llm-models.js',
      '/appui/src/features/ai-sidebar/llm-status.js',
      '/appui/src/features/ai-sidebar/llm-view.js',
      '/appui/src/features/ai-sidebar/llm-discovery.js',
      '/appui/src/features/ai-sidebar/llm-composer.js',
      '/appui/src/features/ai-sidebar/prompt-library.js',
      '/appui/src/features/ai-sidebar/tool-hierarchy-view.js',
      '/appui/src/features/ai-sidebar/tool-hierarchy.js',
      '/appui/src/features/ai-sidebar/selection-state.js',
      '/appui/src/features/ai-sidebar/context-settings-view.js',
      '/appui/src/features/ai-sidebar/context-settings.js',
      '/appui/src/features/ai-sidebar/tabs.js',
      '/appui/src/features/ai-sidebar/selection-menu.js',
      '/appui/src/features/ai-sidebar/chat-actions.js',
      '/appui/src/features/ai-sidebar/workflow-selection.js',
      '/appui/src/features/ai-sidebar/tool-catalog.js',
      '/appui/src/features/ai-sidebar/context-controller.js',
      '/appui/src/features/ai-sidebar/workflow-controller.js',
      '/appui/src/features/ai-sidebar/core.js',
      '/appui/src/features/ai-sidebar/page-introspect.js',
      '/appui/src/features/ai-sidebar/vis-page-provider.js',
      '/appui/src/features/ai-sidebar/page-capture.js',
      '/appui/src/features/ai-sidebar/page-actions-see.js',
      '/appui/src/features/ai-sidebar/page-actions-recording.js',
      '/appui/src/features/ai-sidebar/page-actions.js',
      '/appui/src/features/ai-sidebar/chat-panel-actions.js',
      '/appui/src/features/ai-sidebar/chat-panel-context.js',
      '/appui/src/features/ai-sidebar/chat-panel-view.js',
      '/appui/src/features/ai-sidebar/chat-panel-profiles.js',
      '/appui/src/features/ai-sidebar/chat-panel.js',
      '/appui/src/features/ai-sidebar/index.js'
    ],
    'fileExplorer': [
      '/appui/src/runtime/file-watch.js',
      '/appui/src/features/file-explorer/backend-collections.js',
      '/appui/src/features/file-explorer/backend-file-storage.js',
      '/appui/src/features/file-explorer/backend-local-dir.js',
      '/appui/src/features/file-explorer/backend-vfs.js',
      '/appui/src/features/file-explorer/node-model.js',
      '/appui/src/features/file-explorer/routing.js',
      '/appui/src/features/file-explorer/expansion.js',
      '/appui/src/features/file-explorer/file-actions.js',
      '/appui/src/features/file-explorer/uploads.js',
      '/appui/src/features/file-explorer/drag-drop.js',
      '/appui/src/features/file-explorer/listing-cache.js',
      '/appui/src/features/file-explorer/properties.js',
      '/appui/src/features/file-explorer/context-menu.js',
      '/appui/src/features/file-explorer/folder-reload.js',
      '/appui/src/features/file-explorer/expansion-state.js',
      '/appui/src/features/file-explorer/session-prebuild.js',
      '/appui/src/features/file-explorer/chrome.js',
      '/appui/src/features/file-explorer/core.js'
    ],
    'contextMenu': [
      '/appui/src/components/context-menu-view.js',
      '/appui/src/components/context-menu.js'
    ],
    'menu': [
      '/appui/src/components/menu-navigation.js',
      '/appui/src/components/menu-model.js',
      '/appui/src/components/menu-source.js',
      '/appui/src/runtime/popup-placement.js',
      '/appui/src/components/menu-view.js',
      '/appui/src/components/menu-popup.js',
      '/appui/src/components/menu.js'
    ],
    'floatingPanel': [
      '/appui/src/components/floating-panel.js'
    ],
    'statusbar': [
      '/appui/src/components/statusbar.js'
    ],
    'palette': [
      '/appui/src/features/command-palette/view.js',
      '/appui/src/features/command-palette/core.js'
    ],
    'notifications': [
      '/appui/src/features/notifications/core.js',
      '/appui/src/features/notifications/index.js'
    ],
    'daemonStatus': [
      '/appui/src/features/daemon-status/details.js',
      '/appui/src/features/daemon-status/core.js'
    ],
    'editorPreview': [
      '/appui/src/features/editor-preview/core.js'
    ],
    'jsonEditor': [
      '/appui/src/components/json-editor-view.js',
      '/appui/src/components/json-editor.js'
    ],
    'sidebarDock': [
      '/appui/src/features/sidebar-dock/view.js',
      '/appui/src/features/sidebar-dock/core.js',
      '/appui/src/features/sidebar-dock/index.js'
    ],
    'feedback': [
      '/appui/src/content/panel-discovery.js',
      '/appui/src/content/panel-embedding.js',
      '/appui/src/content/panel-gallery.js',
      '/appui/src/content/panel-declared.js',
      '/appui/src/content/panel-app.js',
      '/appui/src/components/feedback.js'
    ],
    'urlFields': [
      '/appui/src/runtime/url-fields.js'
    ],
    'ragResults': [
      '/appui/src/components/rag-results.js'
    ],
    'contentTabs': [
      '/appui/src/features/content-tabs.js'
    ],
    'apiInspector': [
      '/appui/src/features/api-inspector/component-tree.js',
      '/appui/src/features/api-inspector/reports.js',
      '/appui/src/features/api-inspector/panel-controls.js',
      '/appui/src/features/api-inspector/network.js',
      '/appui/src/features/api-inspector/core.js'
    ],
    'tableControls': [
      '/appui/src/components/table-columns.js',
      '/appui/src/components/data-table-model.js',
      '/appui/src/components/data-table-filter.js',
      '/appui/src/components/table-controls.js'
    ],
    'dataTable': [
      '/appui/src/components/table-export.js',
      '/appui/src/components/data-table-details.js',
      '/appui/src/components/data-table-header.js',
      '/appui/src/components/data-table-controls.js',
      '/appui/src/components/data-table-rows.js',
      '/appui/src/components/data-table.js'
    ],
    'recentRuns': [
      '/appui/src/components/recent-runs.js'
    ],
    'suggestions': [
      '/appui/src/components/suggestions.js'
    ],
    'textDiff': [
      '/appui/src/runtime/text-diff.js'
    ],
    'demos': [
      '/appui/src/runtime/demos.js'
    ],
    'breadcrumbs': [
      '/appui/src/content/breadcrumbs.js'
    ],
    'streamEvents': [
      '/appui/src/runtime/stream-events.js'
    ],
    'runtimeServices': [
      '/appui/src/runtime/api-queue.js',
      '/appui/src/runtime/api-guard.js',
      '/appui/src/runtime/daemon-ports.js',
      '/appui/src/runtime/event-bus-dispatch.js',
      '/appui/src/runtime/event-bus-transport.js',
      '/appui/src/runtime/event-bus.js',
      '/appui/src/runtime/restart-banner.js',
      '/appui/src/runtime/event-log.js',
      '/appui/src/runtime/data-bind-cache.js',
      '/appui/src/runtime/data-bind-values.js',
      '/appui/src/runtime/data-bind-dom.js',
      '/appui/src/runtime/data-bind-budget.js',
      '/appui/src/runtime/data-bind-batch.js',
      '/appui/src/runtime/data-bind-events.js',
      '/appui/src/runtime/data-bind-fetch.js',
      '/appui/src/runtime/data-bind-sources.js',
      '/appui/src/runtime/data-bind.js',
      '/appui/src/runtime/page-utils.js',
      '/appui/src/runtime/node-renderers.js',
      '/appui/src/content/node-renderers-code.js',
      '/appui/src/content/node-renderers-document.js',
      '/appui/src/content/node-renderers-generic.js',
      '/appui/src/runtime/pylondb-client.js',
      '/appui/src/runtime/websocket.js',
      '/appui/src/runtime/tool-socket.js',
      '/appui/src/runtime/backend-selector.js',
      '/appui/src/runtime/ai-pipeline-prompts.js',
      '/appui/src/runtime/ai-pipeline.js',
      '/appui/src/runtime/keys.js',
      '/appui/src/runtime/app-debug-dom.js',
      '/appui/src/runtime/app-debug.js'
    ],
    'browserComponents': [
      '/appui/src/components/selection.js',
      '/appui/src/components/dnd-drag-source.js',
      '/appui/src/components/dnd.js',
      '/appui/src/components/resizer.js',
      '/appui/src/components/watcher.js'
    ],
    'collections': [
      '/appui/src/components/grid-view-card.js',
      '/appui/src/components/grid-view.js',
      '/appui/src/components/stat-cards.js'
    ],
    'contentViews': [
      '/appui/src/content/cards.js',
      '/appui/src/content/table.js'
    ],
    'documentEditors': [
      '/appui/src/content/editor.js',
      '/appui/src/content/wysiwyg.js',
      '/appui/src/content/live-edit-pane.js'
    ],
    'pylonDB': [
      '/appui/src/pylondb/registry.js',
      '/appui/src/pylondb/defaults-paths.js',
      '/appui/src/pylondb/defaults.js',
      '/appui/src/pylondb/defaults-documents.js',
      '/appui/src/pylondb/defaults-code.js',
      '/appui/src/pylondb/defaults-records.js',
      '/appui/src/pylondb/processor-history.js',
      '/appui/src/pylondb/processor-results.js',
      '/appui/src/pylondb/processor-menu.js',
      '/appui/src/pylondb/processors.js'
    ],
    'previewEditors': [
      '/appui/src/preview/base.js',
      '/appui/src/preview/json.js',
      '/appui/src/preview/json-editor.js'
    ],
    'fileDialog': [
      '/appui/src/components/file-dialog-controls.js',
      '/appui/src/components/file-dialog-list.js',
      '/appui/src/components/file-dialog-details.js',
      '/appui/src/components/file-dialog.js'
    ],
    'virtualScroll': [
      '/appui/src/components/virtual-scroll-model.js',
      '/appui/src/components/virtual-scroll.js'
    ],
    'bigTable': [
      '/appui/src/components/big-table.js',
      '/appui/src/components/table-workbench.js'
    ],
    'chart': [
      '/appui/src/components/chart.js'
    ],
    'chips': [
      '/appui/src/components/chips.js'
    ],
    'converterPage': [
      '/appui/src/features/converter-page.js'
    ],
    'graphInteractions': [
      '/appui/src/components/graph-drag.js',
      '/appui/src/components/graph-node.js'
    ],
    'chapterTree': [
      '/appui/src/content/chapter-tree.js'
    ],
    'splitter': [
      '/appui/src/components/split.js'
    ],
    'folderPicker': [
      '/appui/src/components/folder-picker.js',
      '/appui/src/components/folder-picker-flat.js'
    ],
    'workspaceFolderPicker': [
      '/appui/src/components/workspace-folder-picker.js'
    ],
    'visExplorer': [
      '/appui/src/features/vis-explorer-styles.js',
      '/appui/src/features/vis-explorer-view.js',
      '/appui/src/features/vis-explorer.js'
    ],
    'remoteBrowserViewer': [
      '/appui/src/components/remote-browser-viewer.js'
    ],
    'map': [
      '/appui/src/components/map-route.js',
      '/appui/src/components/map.js'
    ],
    'article': [
      '/appui/src/components/article.js'
    ],
    'codemirror': [
      '/appui/lib/codemirror/codemirror.min.js',
      '/appui/lib/codemirror/addon-overlay.min.js',
      '/appui/lib/codemirror/addon-foldcode.min.js',
      '/appui/lib/codemirror/addon-foldgutter.min.js',
      '/appui/lib/codemirror/addon-indent-fold.min.js',
      '/appui/lib/codemirror/addon-markdown-fold.min.js',
      '/appui/lib/codemirror/mode-xml.min.js',
      '/appui/lib/codemirror/mode-yaml.min.js',
      '/appui/lib/codemirror/mode-markdown.min.js',
      '/appui/lib/codemirror/mode-gfm.min.js',
      '/appui/lib/codemirror/mode-yaml-frontmatter.min.js'
    ],
  };
  var _bundleDeps = {
  "navigationLinks": [
    "foundation"
  ],
  "feedback": [
    "foundation"
  ],
  "chatSurface": [
    "foundation",
    "chatView",
    "streamEvents"
  ],
  "shell": [
    "foundation"
  ],
  "templateBootstrap": [
    "shell"
  ],
  "tree": [
    "foundation"
  ],
  "sidebarSections": [
    "foundation"
  ],
  "workspaceComponents": [
    "foundation",
    "sidebarSections",
    "tree",
    "floatingPanel",
    "toolbar",
    "tabs",
    "pagination",
    "splitter"
  ],
  "suggestions": [
    "foundation"
  ],
  "textDiff": [
    "foundation"
  ],
  "demos": [
    "foundation"
  ],
  "breadcrumbs": [
    "foundation"
  ],
  "aiSidebar": [
    "chatSurface"
  ],
  "chatView": [
    "foundation"
  ],
  "fileExplorer": [
    "foundation",
    "tree",
    "contextMenu"
  ],
  "contextMenu": [
    "foundation"
  ],
  "floatingPanel": [
    "foundation"
  ],
  "palette": [
    "foundation"
  ],
  "notifications": [
    "foundation"
  ],
  "daemonStatus": [
    "foundation"
  ],
  "editorPreview": [
    "foundation",
    "workspaceComponents"
  ],
  "jsonEditor": [
    "foundation"
  ],
  "sidebarDock": [
    "foundation"
  ],
  "urlFields": [
    "foundation"
  ],
  "contentTabs": [
    "foundation",
    "tabs"
  ],
  "apiInspector": [
    "foundation"
  ],
  "tableControls": [
    "foundation",
    "toolbar"
  ],
  "dataTable": [
    "tableControls",
    "foundation",
    "toolbar",
    "virtualScroll"
  ],
  "recentRuns": [
    "foundation"
  ],
  "streamEvents": [
    "foundationCore"
  ],
  "runtimeServices": [
    "foundation"
  ],
  "browserComponents": [
    "foundation",
    "streamEvents",
    "virtualScroll",
    "collections"
  ],
  "collections": [
    "foundation"
  ],
  "contentViews": [
    "foundation",
    "breadcrumbs"
  ],
  "documentEditors": [
    "foundation",
    "chapterTree"
  ],
  "pylonDB": [
    "foundation"
  ],
  "previewEditors": [
    "foundation"
  ],
  "fileDialog": [
    "foundation",
    "collections",
    "toolbar"
  ],
  "menu": [
    "foundationCore"
  ],
  "statusbar": [
    "foundationCore",
    "dialog"
  ],
  "virtualScroll": [
    "foundation"
  ],
  "bigTable": [
    "tableControls",
    "foundation"
  ],
  "chart": [
    "foundation"
  ],
  "converterPage": [
    "foundation",
    "toolbar",
    "dataTable"
  ],
  "graphInteractions": [
    "foundation"
  ],
  "logView": [
    "foundation"
  ],
  "toolbar": [
    "foundation"
  ],
  "tabs": [
    "foundation"
  ],
  "pagination": [
    "foundation",
    "toolbar"
  ],
  "chapterTree": [
    "foundation"
  ],
  "splitter": [
    "foundation"
  ],
  "folderPicker": [
    "foundation"
  ],
  "workspaceFolderPicker": [
    "foundation",
    "folderPicker"
  ],
  "visExplorer": [
    "foundation"
  ],
  "remoteBrowserViewer": [
    "foundation"
  ],
  "map": [
    "foundation"
  ],
  "article": [
    "foundation"
  ],
  "foundation": [
    "foundationCore",
    "dialog",
    "menu",
    "statusbar"
  ],
  "dialog": [
    "foundationCore"
  ]
};
  var _cssDefs = [
    '/appui/assets/styles/theme.css',
    '/appui/assets/styles/ui-components.css',
    '/appui/src/components/styles.css',
    '/appui/src/components/common-elements.css',
    '/appui/src/shell/styles.css'
  ];
  /* BUNDLES_END */

  // Bootstrap transport: available before any AppUI bundle can be loaded.
  // Scripts and styles share timeout/retry ownership; their callers own caching.
  function loadElement(url, attempt, style) {
    attempt = attempt || 0;
    return new Promise(function(resolve, reject) {
      var started = performance.now();
      var settled = false;
      var element = document.createElement(style ? 'link' : 'script');
      var src = versioned(url);
      if (attempt) src += (src.indexOf('?') >= 0 ? '&' : '?') + 'retry=' + attempt;
      if (style) { element.rel = 'stylesheet'; element.href = src; }
      else { element.src = src; element.async = false; }
      var timer = setTimeout(function() { fail('timeout'); }, 10000);
      function record(status) {
        var event = {url: url, attempt: attempt + 1, status: status,
          duration: Math.round(performance.now() - started), time: Date.now()};
        if (style) event.type = 'style';
        recordLoad(event);
      }
      element.onload = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (style) _loadedStyles.add(url);
        record('loaded');
        resolve();
      };
      function fail(reason) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        record(reason);
        element.remove();
        if (attempt < 2) {
          setTimeout(function() {
            loadElement(url, attempt + 1, style).then(resolve, reject);
          }, 100 * (attempt + 1));
          return;
        }
        reject(new Error((style ? 'CSS load' : 'Load') + ' failed after 3 attempts: ' + url));
      }
      element.onerror = function() { fail('failed'); };
      document.head.appendChild(element);
    });
  }

  function loadScript(url, attempt) { return loadElement(url, attempt, false); }

  function loadModule(src) {
    // Resolve page-relative URLs against the document, not this loader's URL.
    // Preserve the caller's version query; native imports resolve dependencies.
    var url;
    try { url = new URL(src, document.baseURI || location.href).href; }
    catch (error) { return Promise.reject(error); }
    if (_modulePromises.has(url)) return _modulePromises.get(url);
    // Browsers cache rejected native imports too. A retry needs a fresh URL,
    // while callers still share one promise under the original module URL.
    var requestUrl = url;
    var retry = _moduleRetries.get(url) || 0;
    if (retry) {
      var retryUrl = new URL(url);
      retryUrl.searchParams.set('_appui_retry', retry);
      requestUrl = retryUrl.href;
    }
    var started = performance.now();
    var promise = import(requestUrl).then(function(namespace) {
      _moduleRetries.delete(url);
      _loadedModules.add(url);
      recordLoad({url: url, type: 'module', status: 'loaded', duration: Math.round(performance.now() - started), time: Date.now()});
      return namespace;
    }, function(error) {
      _modulePromises.delete(url);
      _moduleRetries.set(url, retry + 1);
      recordLoad({url: url, type: 'module', status: 'failed', duration: Math.round(performance.now() - started), time: Date.now()});
      throw error;
    });
    _modulePromises.set(url, promise);
    return promise;
  }

  function registerServiceWorker() {
    // The public worker caches /appui assets and owns the platform root scope.
    // Portable deployments use normal HTTP caching under their own prefix.
    if (window.PYLON_API_ORIGIN || (window.APPUI_BASE && window.APPUI_BASE !== '/appui/')) return Promise.resolve(null);
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    // ROUND3 #33: sw.js was fetched on EVERY page load (an explicit update() per load + the navigation soft-update
    // with the default updateViaCache 'imports', which bypasses the HTTP cache) - ~2k requests per 60k log lines.
    // Now: the HTTP cache serves sw.js for its short max-age (updateViaCache 'all'), and the explicit update runs at
    // most every 30 min per browser. A new worker still lands within minutes.
    return navigator.serviceWorker.register('/appui/sw.js', {scope: '/', updateViaCache: 'all'}).then(function(registration) {
      var now = Date.now(), last = 0;
      try { last = Number(localStorage.getItem('appui.sw.updatedAt')) || 0; } catch (e) {}
      if (now - last > 30 * 60 * 1000) {
        try { localStorage.setItem('appui.sw.updatedAt', String(now)); } catch (e) {}
        registration.update().catch(function() {});
      }
      return registration;
    }).catch(function(error) {
      recordLoad({url: '/appui/sw.js', attempt: 1, status: error.message, time: Date.now()});
      return null;
    });
  }

  function loadStyle(url, attempt) {
    if (_loadedStyles.has(url)) return Promise.resolve();
    if (!attempt && _stylePromises.has(url)) return _stylePromises.get(url);
    var promise = loadElement(url, attempt, true)
      .finally(function() { _stylePromises.delete(url); });
    _stylePromises.set(url, promise);
    return promise;
  }

  function diagnostics() {
    return {
      assetVersion: _assetVersion || _fwVersion || null,
      serviceWorker: navigator.serviceWorker?.controller?.scriptURL || null,
      loadedBundles: Array.from(loaded.keys()),
      loadedFiles: Array.from(_loadedFiles),
      loadingFiles: Array.from(_filePromises.keys()),
      loadedModules: Array.from(_loadedModules),
      loadingModules: Array.from(_modulePromises.keys()).filter(function(url) { return !_loadedModules.has(url); }),
      loadedStyles: Array.from(_loadedStyles),
      loadingStyles: Array.from(_stylePromises.keys()),
      events: _loadEvents.slice(-200),
    };
  }

  function clearCacheAndReload() {
    return Promise.all([
      window.caches?.keys?.().then(function(keys) {
        return Promise.all(keys.filter(function(key) { return key.indexOf('appui-') === 0; }).map(function(key) {
          return window.caches.delete(key);
        }));
      }) || Promise.resolve(),
      navigator.serviceWorker?.getRegistration?.('/').then(function(registration) {
        return registration?.update?.();
      }) || Promise.resolve(),
    ]).finally(function() { location.reload(); });
  }

  function loadFilesSequentially(files) {
    return files.reduce(function(chain, file) {
      return chain.then(function() {
        if (_loadedFiles.has(file)) return Promise.resolve();
        if (_filePromises.has(file)) return _filePromises.get(file);
        var promise = loadScript(file).then(function() {
          _loadedFiles.add(file);
          _filePromises.delete(file);
        }, function(error) {
          _filePromises.delete(file);
          throw error;
        });
        _filePromises.set(file, promise);
        return promise;
      });
    }, Promise.resolve());
  }

  Object.assign(window.AppUIAssets, {
    base: window.APPUI_BASE || '/appui/',
    loaded: loaded,
    serviceWorkerReady: registerServiceWorker(),
    diagnostics: diagnostics,
    clearCacheAndReload: clearCacheAndReload,
    // ROUND3 #33: a URL with the loader's effective asset version (the page's ?v= or the build-stamped _fwVersion),
    // for assets fetched outside loadScript/loadStyle (e.g. the SSE SharedWorker script) so they cache immutably.
    versioned: versioned,

    load: function() {
      var names = Array.prototype.slice.call(arguments);
      function loadBundle(name, trail) {
        trail = trail || [];
        if (!_bundleDefs[name]) return Promise.reject(new Error('Unknown AppUI bundle: ' + name));
        if (trail.indexOf(name) >= 0) return Promise.reject(new Error('AppUI bundle dependency cycle: ' + trail.concat(name).join(' -> ')));
        if (loaded.has(name)) return loaded.get(name);
        var bundled = (window.APPUI_BUNDLES && window.APPUI_BUNDLES[name])
          || ('/appui/bundle/' + name + '.js');
        if (window.APPUI_MINIFY !== false) bundled += (bundled.indexOf('?') < 0 ? '?' : '&') + 'minify=1';
        // Fetch dependent bundles while prerequisites execute. Script execution
        // still follows the dependency DAG below; the browser reuses this fetch.
        var preloadUrl = versioned(bundled);
        if (!_preloadedBundles.has(preloadUrl)) {
          _preloadedBundles.add(preloadUrl);
          var hint = document.createElement('link');
          hint.rel = 'preload'; hint.as = 'script'; hint.href = preloadUrl;
          document.head.appendChild(hint);
        }
        var dependencies = _bundleDeps[name] || [];
        // #17: load a bundle's prerequisite bundles IN PARALLEL (respecting the
        // DAG) rather than strictly one-after-another. Each dependency's OWN
        // prereq chain is still ordered inside its loadBundle() recursion, and
        // `loaded` memoizes so a shared dep (e.g. foundation) is fetched once
        // even when several siblings depend on it — so a multi-dep bundle's cold
        // load is bounded by the DEPTH of the graph, not the SUM of its deps.
        var promise = Promise.all(dependencies.map(function(dependency) {
          return loadBundle(dependency, trail.concat(name));
        })).then(function() {
          // Compatibility aliases can share sources with their prerequisites.
          if (_bundleDefs[name].every(function(file) { return _loadedFiles.has(file); })) return;
          // Prefer the server's ONE concatenated response at /appui/bundle/<name>
          // (framework/bundler.py) — a single request instead of loading every
          // member file sequentially (which was ~120 serial round-trips across
          // foundation+shell+chatView+aiSidebar). window.APPUI_BUNDLES can still
          // override with a prebuilt URL; otherwise fall back to per-file loads
          // only if the concatenated fetch fails. Pass the BARE url to
          // loadScript — it applies versioned() itself (passing an
          // already-versioned url produced a doubled ?v=X&v=X).
          return loadScript(bundled).then(function() {
            _bundleDefs[name].forEach(function(file) { _loadedFiles.add(file); });
          }).catch(function() { return loadFilesSequentially(_bundleDefs[name]); });
        }).catch(function(error) {
          loaded.delete(name);
          throw error;
        });
        loaded.set(name, promise);
        return promise;
      }
      // #17: the requested top-level bundles are independent (each resolves its
      // own dependency DAG + memoizes shared deps via `loaded`), so load them in
      // PARALLEL rather than sequentially. Promise.all rejects if any fails,
      // preserving the previous all-or-nothing contract.
      return Promise.all(names.map(function(name) { return loadBundle(name); }));
    },

    loadCss: function() {
      if (this.cssReady) return this.cssReady;
      var self = this;
      this.cssReady = Promise.all((_cssDefs || []).map(function(url) { return loadStyle(url); })).then(function(r) {
        // Styles are up -- clear the self-heal guard so a FUTURE cold failure
        // (e.g. a later flyout relaunch) can heal again rather than being
        // permanently suppressed by a stale flag from an earlier heal.
        try { sessionStorage.removeItem('__appui_css_reload'); } catch (_e) {}
        return r;
      }).catch(function(error) {
        self.cssReady = null;
        // Critical shell/theme CSS failed every retry (observed in the tray's
        // WebView2 flyout on a cold profile: a burst of ~40+ asset GETs hits the
        // single-loop web gateway at once and some connections are dropped past
        // loadStyle's 3-attempt budget). Leaving the page unstyled is a dead end,
        // so self-heal ONCE: clear the appui caches + SW and reload, which both
        // warms the cache and re-issues the requests spread over a fresh load.
        // A sessionStorage guard prevents a reload loop if the server is truly
        // down -- after one attempt we give up and surface the original error.
        try {
          var KEY = '__appui_css_reload';
          var already = false;
          try { already = sessionStorage.getItem(KEY) === '1'; } catch (_e) { already = false; }
          if (!already && typeof clearCacheAndReload === 'function') {
            try { sessionStorage.setItem(KEY, '1'); } catch (_e) {}
            recordLoad({url: 'loadCss', status: 'self-heal-reload', type: 'style', time: Date.now()});
            clearCacheAndReload();
            // Return a never-resolving promise: the reload is imminent, so
            // callers should not proceed to mount against a soon-dead document.
            return new Promise(function() {});
          }
        } catch (_e) { /* fall through to rethrow */ }
        throw error;
      });
      return this.cssReady;
    },

    loadScript: function(src) { return loadFilesSequentially([src]); },
    loadModule: loadModule,
    preload: function() { /* reserved */ }
  });
})();
