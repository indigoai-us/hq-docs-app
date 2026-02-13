use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, SystemTime};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager, State};

/// A node in the file tree returned by the scanner.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    /// Display name (filename or directory name)
    pub name: String,
    /// Absolute filesystem path
    pub path: String,
    /// Whether this node is a directory
    pub is_directory: bool,
    /// Title extracted from the first `# ` heading in .md files
    pub title: Option<String>,
    /// Child nodes (populated for directories)
    pub children: Vec<FileTreeNode>,
    /// Depth in the tree (0 = root scope directory)
    pub depth: u32,
    /// Number of .md files in this subtree (for directories)
    pub file_count: u32,
    /// Last modified timestamp (seconds since epoch)
    pub modified: Option<u64>,
}

/// Payload emitted to the frontend when a file-system change is detected.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEvent {
    /// Absolute path that changed
    pub path: String,
    /// "modify" | "create" | "remove" — indicates type of change
    pub kind: String,
}

/// Directories to exclude from file watching (same as scan exclusions).
const WATCH_EXCLUDES: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    ".next",
    ".turbo",
    ".vercel",
    "target",
    ".DS_Store",
    "thumbs.db",
];

/// Shared state that holds the active file-watcher handle.
/// When the handle is dropped the watcher thread is stopped.
struct WatcherState {
    /// We only need to keep the debouncer alive; dropping it stops the watcher.
    _debouncer: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>,
}

/// Extract the title from a markdown file by reading the first `# ` heading.
/// Only reads first 50 lines for performance.
fn extract_md_title(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    for line in reader.lines().take(50) {
        if let Ok(line) = line {
            let trimmed = line.trim();
            if let Some(title) = trimmed.strip_prefix("# ") {
                let title = title.trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
    }
    None
}

/// Get modified time as seconds since epoch.
fn get_modified_secs(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

/// Check if a path should be excluded from scanning.
fn should_exclude(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "dist"
            | ".next"
            | ".turbo"
            | ".vercel"
            | "target"
            | ".DS_Store"
            | "thumbs.db"
    ) || name.starts_with('.')
}

/// Recursively scan a directory and build a file tree.
/// Follows symlinks transparently. Only includes .md files and directories
/// that contain .md files (directly or in subdirectories).
fn scan_dir_recursive(path: &Path, depth: u32, max_depth: u32) -> Option<FileTreeNode> {
    if depth > max_depth {
        return None;
    }

    // Resolve symlinks to canonical path for reading
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

    let entries = match fs::read_dir(&canonical) {
        Ok(entries) => entries,
        Err(_) => return None,
    };

    let mut children: Vec<FileTreeNode> = Vec::new();
    let mut file_count: u32 = 0;

    let mut entries_vec: Vec<_> = entries
        .filter_map(|e| e.ok())
        .collect();

    // Sort entries: directories first, then alphabetically
    entries_vec.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in entries_vec {
        let name = entry.file_name().to_string_lossy().to_string();

        if should_exclude(&name) {
            continue;
        }

        let entry_path = entry.path();

        // Follow symlinks: check the target type
        let metadata = match fs::metadata(&entry_path) {
            Ok(m) => m,
            Err(_) => continue, // Broken symlink or permission denied
        };

        if metadata.is_dir() {
            if let Some(child) = scan_dir_recursive(&entry_path, depth + 1, max_depth) {
                if child.file_count > 0 {
                    file_count += child.file_count;
                    children.push(child);
                }
            }
        } else if metadata.is_file() && name.ends_with(".md") {
            let title = extract_md_title(&entry_path);
            let modified = get_modified_secs(&entry_path);
            file_count += 1;
            children.push(FileTreeNode {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_directory: false,
                title,
                children: Vec::new(),
                depth: depth + 1,
                file_count: 0,
                modified,
            });
        }
    }

    let dir_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    Some(FileTreeNode {
        name: dir_name,
        path: path.to_string_lossy().to_string(),
        is_directory: true,
        title: None,
        children,
        depth,
        file_count,
        modified: get_modified_secs(path),
    })
}

/// Tauri command: scan the HQ directory for .md files within the given scoped paths.
///
/// `hq_path`: Absolute path to the HQ root folder.
/// `scopes`: List of relative scope patterns to scan (e.g., "knowledge/public", "companies/*/knowledge").
///           Glob `*` in a single path segment expands to all subdirectories at that level.
///
/// Returns a flat list of FileTreeNode roots, one per matched scope directory.
#[tauri::command]
fn scan_hq_directory(hq_path: String, scopes: Vec<String>) -> Result<Vec<FileTreeNode>, String> {
    let hq = PathBuf::from(&hq_path);

    if !hq.is_dir() {
        return Err(format!("HQ path is not a directory: {}", hq_path));
    }

    let mut results: Vec<FileTreeNode> = Vec::new();

    for scope in &scopes {
        let scope_paths = expand_scope(&hq, scope);

        for scope_path in scope_paths {
            if !scope_path.is_dir() {
                // Try following symlink
                if let Ok(canonical) = fs::canonicalize(&scope_path) {
                    if !canonical.is_dir() {
                        continue;
                    }
                    // Use the canonical path for scanning but keep the original name
                    if let Some(mut node) = scan_dir_recursive(&scope_path, 0, 15) {
                        // Use the relative scope path as the display path
                        node.path = scope_path.to_string_lossy().to_string();
                        results.push(node);
                    }
                }
                continue;
            }

            if let Some(node) = scan_dir_recursive(&scope_path, 0, 15) {
                if node.file_count > 0 {
                    results.push(node);
                }
            }
        }
    }

    Ok(results)
}

/// Start watching scoped directories for file changes.
///
/// Resolves scopes the same way as `scan_hq_directory`, then watches each
/// concrete directory recursively. File-system events are debounced (500 ms)
/// and emitted to the frontend as `"fs-change"` events.
#[tauri::command]
fn start_watching(
    hq_path: String,
    scopes: Vec<String>,
    app: tauri::AppHandle,
    state: State<'_, Mutex<WatcherState>>,
) -> Result<(), String> {
    let hq = PathBuf::from(&hq_path);
    if !hq.is_dir() {
        return Err(format!("HQ path is not a directory: {}", hq_path));
    }

    // Collect concrete directories to watch
    let mut dirs: Vec<PathBuf> = Vec::new();
    for scope in &scopes {
        let expanded = expand_scope(&hq, scope);
        for dir in expanded {
            if dir.is_dir() {
                dirs.push(dir);
            } else if let Ok(canonical) = fs::canonicalize(&dir) {
                if canonical.is_dir() {
                    dirs.push(dir);
                }
            }
        }
    }

    if dirs.is_empty() {
        return Err("No valid directories to watch".to_string());
    }

    // Create debounced watcher (500 ms debounce)
    let app_handle = app.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(500), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
        match res {
            Ok(events) => {
                for event in events {
                    let path_str = event.path.to_string_lossy().to_string();

                    // Skip excluded directories
                    let should_skip = event.path.components().any(|c| {
                        if let std::path::Component::Normal(name) = c {
                            let n = name.to_string_lossy();
                            WATCH_EXCLUDES.iter().any(|ex| n.as_ref() == *ex)
                                || n.starts_with('.')
                        } else {
                            false
                        }
                    });
                    if should_skip {
                        continue;
                    }

                    // Only care about .md files for content changes
                    // but emit all file changes so the frontend can decide
                    let kind = match event.kind {
                        DebouncedEventKind::Any => {
                            // Determine create vs modify vs remove
                            if event.path.exists() {
                                "modify"
                            } else {
                                "remove"
                            }
                        }
                        DebouncedEventKind::AnyContinuous => "modify",
                        _ => "modify",
                    };

                    let payload = FsChangeEvent {
                        path: path_str,
                        kind: kind.to_string(),
                    };

                    let _ = app_handle.emit("fs-change", payload);
                }
            }
            Err(e) => {
                eprintln!("File watcher error: {:?}", e);
            }
        }
    })
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    // Watch each scope directory recursively
    for dir in &dirs {
        debouncer
            .watcher()
            .watch(dir, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch {}: {}", dir.display(), e))?;
    }

    // Store the debouncer — replaces any previous watcher
    let mut guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    guard._debouncer = Some(debouncer);

    Ok(())
}

/// Stop the active file watcher.
#[tauri::command]
fn stop_watching(state: State<'_, Mutex<WatcherState>>) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    guard._debouncer = None;
    Ok(())
}

// ---------------------------------------------------------------------------
// qmd search integration
// ---------------------------------------------------------------------------

/// A single search result returned by qmd.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QmdSearchResult {
    /// Document ID (e.g. "#abc123")
    #[serde(default)]
    pub doc_id: String,
    /// Relevance score 0.0–1.0
    #[serde(default)]
    pub score: f64,
    /// Document title
    #[serde(default)]
    pub title: String,
    /// File path (may have qmd prefix)
    #[serde(alias = "file", default)]
    pub file_path: String,
    /// Matched text snippet
    #[serde(default)]
    pub snippet: String,
}

/// Result of the qmd search command.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QmdSearchResponse {
    pub results: Vec<QmdSearchResult>,
    pub total: usize,
    pub error: Option<String>,
}

/// Check if qmd is installed and available in PATH.
#[tauri::command]
fn check_qmd_available() -> Result<bool, String> {
    match Command::new("qmd").arg("--version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Execute a qmd search and return parsed JSON results.
///
/// `query`: The search query string.
/// `mode`: "keyword" | "semantic" | "hybrid" — maps to qmd search/vsearch/query.
/// `collection`: Optional collection to scope the search (e.g. "hq", "vyg").
/// `limit`: Max number of results to return.
#[tauri::command]
fn qmd_search(
    query: String,
    mode: String,
    collection: Option<String>,
    limit: Option<u32>,
) -> Result<QmdSearchResponse, String> {
    if query.trim().is_empty() {
        return Ok(QmdSearchResponse {
            results: Vec::new(),
            total: 0,
            error: None,
        });
    }

    // Map mode to qmd subcommand
    let subcmd = match mode.as_str() {
        "keyword" => "search",
        "semantic" => "vsearch",
        "hybrid" | _ => "query",
    };

    let n = limit.unwrap_or(10);

    let mut cmd = Command::new("qmd");
    cmd.arg(subcmd)
        .arg(&query)
        .arg("--json")
        .arg("-n")
        .arg(n.to_string());

    // Add collection scoping if provided
    if let Some(ref coll) = collection {
        if !coll.is_empty() && coll != "all" {
            cmd.arg("-c").arg(coll);
        }
    }

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "qmd not found in PATH. Install qmd for search functionality.".to_string()
        } else {
            format!("Failed to execute qmd: {}", e)
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(QmdSearchResponse {
            results: Vec::new(),
            total: 0,
            error: Some(format!("qmd error: {}", stderr.trim())),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse the JSON output — qmd returns an array of result objects
    let results: Vec<QmdSearchResult> = serde_json::from_str(&stdout).unwrap_or_else(|_| {
        // Try parsing as newline-delimited JSON
        stdout
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(|line| serde_json::from_str::<QmdSearchResult>(line).ok())
            .collect()
    });

    let total = results.len();

    Ok(QmdSearchResponse {
        results,
        total,
        error: None,
    })
}

/// List available qmd collections.
#[tauri::command]
fn list_qmd_collections() -> Result<Vec<String>, String> {
    let output = Command::new("qmd")
        .arg("collection")
        .arg("list")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "qmd not found in PATH".to_string()
            } else {
                format!("Failed to execute qmd: {}", e)
            }
        })?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let collections: Vec<String> = stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(collections)
}

// ---------------------------------------------------------------------------
// File metadata for the metadata bar (US-013)
// ---------------------------------------------------------------------------

/// Metadata about a single file, returned by `get_file_metadata`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    /// Word count (whitespace-delimited tokens in the file)
    pub word_count: u32,
    /// Estimated reading time in minutes (word_count / 200, minimum 1)
    pub reading_time_minutes: u32,
    /// File size in bytes
    pub file_size: u64,
    /// Last modified timestamp (seconds since epoch)
    pub modified: Option<u64>,
    /// Absolute file path
    pub file_path: String,
    /// If this path is a symlink, the resolved real path; otherwise null
    pub symlink_target: Option<String>,
    /// Repository name extracted from symlink target (e.g. "knowledge-ralph")
    pub source_repo_name: Option<String>,
}

/// Get metadata for a file (word count, reading time, size, modified, symlink info).
#[tauri::command]
fn get_file_metadata(file_path: String) -> Result<FileMetadata, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let word_count = content.split_whitespace().count() as u32;
    let reading_time_minutes = (word_count / 200).max(1);

    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let file_size = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    // Check if the file or any ancestor directory is a symlink
    let symlink_metadata = fs::symlink_metadata(path).ok();
    let is_direct_symlink = symlink_metadata
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false);

    let (symlink_target, source_repo_name) = if is_direct_symlink {
        // The file itself is a symlink
        let target = fs::read_link(path)
            .ok()
            .and_then(|t| fs::canonicalize(path).ok().or(Some(t.to_path_buf())))
            .map(|t| t.to_string_lossy().to_string());
        let repo_name = target
            .as_ref()
            .and_then(|t| extract_repo_name_from_path(t));
        (target, repo_name)
    } else {
        // Check if the canonical path differs (ancestor is a symlink)
        let canonical = fs::canonicalize(path).ok();
        let canonical_str = canonical.as_ref().map(|c| c.to_string_lossy().to_string());
        if canonical_str.as_deref() != Some(&file_path) && canonical_str.is_some() {
            let repo_name = canonical_str
                .as_ref()
                .and_then(|t| extract_repo_name_from_path(t));
            (canonical_str, repo_name)
        } else {
            (None, None)
        }
    };

    Ok(FileMetadata {
        word_count,
        reading_time_minutes,
        file_size,
        modified,
        file_path: file_path.clone(),
        symlink_target,
        source_repo_name,
    })
}

/// Extract repository name from a resolved symlink path.
/// Looks for patterns like `/repos/public/{repo-name}/` or `/repos/private/{repo-name}/`.
fn extract_repo_name_from_path(path: &str) -> Option<String> {
    // Match repos/{public|private}/{name}/ in the resolved path
    for part in path.split("/repos/").skip(1) {
        let segments: Vec<&str> = part.split('/').collect();
        if segments.len() >= 2 {
            // segments[0] = "public" or "private", segments[1] = repo name
            let repo_name = segments[1].to_string();
            if !repo_name.is_empty() {
                return Some(repo_name);
            }
        }
    }
    None
}

/// Get the last git commit date for a file.
///
/// Shells out to `git log -1 --format=%cI -- <file>` to get the ISO8601 commit date.
/// Returns None (as null) if git is not available or the file is not tracked.
#[tauri::command]
fn get_git_commit_date(file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Determine the working directory (parent of the file)
    let work_dir = path.parent().unwrap_or(Path::new("/"));

    let output = Command::new("git")
        .arg("log")
        .arg("-1")
        .arg("--format=%cI")
        .arg("--")
        .arg(&file_path)
        .current_dir(work_dir)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let date = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if date.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(date))
                }
            } else {
                // Git command failed (not a git repo, file not tracked, etc.)
                Ok(None)
            }
        }
        Err(_) => {
            // Git not found in PATH
            Ok(None)
        }
    }
}

/// Expand a scope pattern like "companies/*/knowledge" into concrete paths.
/// Supports a single `*` wildcard that matches any subdirectory.
fn expand_scope(hq: &Path, scope: &str) -> Vec<PathBuf> {
    let parts: Vec<&str> = scope.split('/').collect();

    // Find position of wildcard
    let wildcard_pos = parts.iter().position(|&p| p == "*");

    match wildcard_pos {
        Some(pos) => {
            // Build prefix path up to the wildcard
            let prefix: PathBuf = parts[..pos].iter().collect();
            let prefix_path = hq.join(&prefix);

            // Read directory entries at the wildcard level
            let entries = match fs::read_dir(&prefix_path) {
                Ok(entries) => entries,
                Err(_) => return Vec::new(),
            };

            let suffix_parts = &parts[pos + 1..];

            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.file_type()
                        .map(|t| t.is_dir() || t.is_symlink())
                        .unwrap_or(false)
                })
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    !should_exclude(&name)
                })
                .map(|e| {
                    let mut full = e.path();
                    for part in suffix_parts {
                        full = full.join(part);
                    }
                    full
                })
                .filter(|p| {
                    // Check if the expanded path exists (follow symlinks)
                    p.is_dir() || fs::canonicalize(p).map(|c| c.is_dir()).unwrap_or(false)
                })
                .collect()
        }
        None => {
            // No wildcard - just join directly
            vec![hq.join(scope)]
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(WatcherState { _debouncer: None }))
        .invoke_handler(tauri::generate_handler![scan_hq_directory, start_watching, stop_watching, check_qmd_available, qmd_search, list_qmd_collections, get_file_metadata, get_git_commit_date])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Build the native menu bar
            let about_item = MenuItemBuilder::with_id("about", "About Indigo Docs")
                .build(app)?;
            let preferences_item = MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = PredefinedMenuItem::quit(app, Some("Quit Indigo Docs"))?;

            let app_submenu = SubmenuBuilder::new(app, "Indigo Docs")
                .item(&about_item)
                .item(&separator)
                .item(&preferences_item)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&quit_item)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .fullscreen()
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Apply macOS vibrancy effect
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None)
                    .expect("Failed to apply vibrancy");
            }

            // Apply Windows acrylic blur
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_acrylic;
                let _ = apply_acrylic(&window, Some((18, 18, 18, 200)));
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            // Emit menu item click to the frontend
            let _ = app.emit("menu-item-click", id.to_string());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
