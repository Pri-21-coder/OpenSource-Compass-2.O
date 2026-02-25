/**
 * PR Generator Frontend Logic
 * Supports both Modal Mode (Legacy) and Page Mode (New DevTools).
 * Includes Smart PR Structure Controls for customizable PR sections.
 * Includes editor settings (font size, word wrap, focus mode) for the generated PR textarea.
 */

document.addEventListener('DOMContentLoaded', () => {
    const existingForm = document.getElementById('prGeneratorForm');

    if (existingForm) {
        // We are on the DevTools page where the form exists statically
        setupFormLogic(existingForm);
        setupStructureControls();
        setupEditorSettings();
    } else {
        // We are on another page (Home, Contribute, etc.) - Show FAB to link to DevTools
        injectLinkFAB();
    }
});

function injectLinkFAB() {
    // Premium Floating Action Button for DevTools
    const fabHtml = `
        <button id="prGenFab" class="pr-gen-fab" aria-label="Open Developer Tools">
            <i class="fas fa-terminal"></i>
        </button>
    `;
    document.body.insertAdjacentHTML('beforeend', fabHtml);

    const fab = document.getElementById('prGenFab');
    fab.addEventListener('click', () => {
        const path = window.location.pathname;
        let targetUrl = 'frontend/pages/devtools.html';

        if (path.includes('/pages/')) {
            targetUrl = './devtools.html';
        } else if (path.includes('index.html') || path.endsWith('/')) {
            targetUrl = 'frontend/pages/devtools.html';
        }

        window.location.href = targetUrl;
    });
}

/**
 * Smart PR Structure Controls
 * Manages the collapsible panel and toggle states for PR sections.
 */
function setupStructureControls() {
    const toggleBtn = document.getElementById('structureToggleBtn');
    const panel = document.getElementById('structurePanel');
    const badge = document.getElementById('structureBadge');

    if (!toggleBtn || !panel) return;

    // Expand/collapse panel
    toggleBtn.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', isOpen);
    });

    // Track toggle changes for badge update
    const toggleIds = ['toggleSummary', 'toggleChecklist', 'toggleBreaking', 'toggleScreenshots', 'toggleLinkedIssues'];

    function updateBadge() {
        const activeCount = toggleIds.filter(id => {
            const el = document.getElementById(id);
            return el && el.checked;
        }).length;
        if (badge) {
            badge.textContent = `${activeCount} / ${toggleIds.length} active`;
        }

        // Update the visual state of each toggle item
        toggleIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const item = el.closest('.pr-toggle-item');
                if (item) {
                    item.classList.toggle('disabled', !el.checked);
                }
            }
        });
    }

    toggleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateBadge);
        }
    });

    // Initial badge state
    updateBadge();
}

/**
 * Reads the current state of all structure control toggles.
 * Returns an object with boolean flags for each section.
 */
function getStructureSettings() {
    return {
        includeSummary: document.getElementById('toggleSummary')?.checked ?? true,
        includeChecklist: document.getElementById('toggleChecklist')?.checked ?? true,
        includeBreakingChanges: document.getElementById('toggleBreaking')?.checked ?? true,
        includeScreenshots: document.getElementById('toggleScreenshots')?.checked ?? true,
        includeLinkedIssues: document.getElementById('toggleLinkedIssues')?.checked ?? true,
    };
}

function setupFormLogic(form) {
    const submitBtn = document.getElementById('prSubmitBtn');
    const previewSection = document.getElementById('prPreviewSection');
    const textarea = document.getElementById('prEditorTextarea');
    const copyBtn = document.getElementById('prCopyBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePRGeneration(submitBtn, previewSection, textarea);
    });

    if (copyBtn && textarea) {
        copyBtn.addEventListener('click', () => copyToClipboard(textarea, copyBtn));
    }
}

async function handlePRGeneration(submitBtn, previewSection, textarea) {
    const prLink = document.getElementById('prLink')?.value || "";
    const problem = document.getElementById('prProblem').value;
    const changes = document.getElementById('prChanges').value;
    const testing = document.getElementById('prTesting').value;
    const limitations = document.getElementById('prLimitations').value;

    // Validation: Require either (problem + changes) OR a link
    if (!prLink && (!problem || !changes)) {
        alert("Please provide either an Issue/PR link or both Problem Statement and Changes.");
        return;
    }

    // Fetch project requirements
    let projectRequirements = "Follow standard professional open-source PR practices.";
    try {
        const configResp = await fetch('../data/pr_config.json');
        if (configResp.ok) {
            const config = await configResp.json();
            projectRequirements = config.requirements;
        }
    } catch (e) {
        console.warn('Could not load PR config, using defaults.');
    }

    // Get structure settings from toggles
    const structureSettings = getStructureSettings();

    // Visual feedback
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    previewSection.classList.remove('active');

    try {
        const response = await fetch('http://localhost:5000/api/pr/generate-pr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prLink,
                problem,
                changes,
                testing,
                limitations,
                projectRequirements,
                structureSettings
            }),
        });

        const data = await response.json();

        if (data.prDescription) {
            // Load into editable textarea
            textarea.value = data.prDescription;
            previewSection.classList.add('active');
            // Update word count
            updateWordCount(textarea);
            // Scroll to preview
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            alert('Error: ' + (data.error || 'Failed to generate PR.'));
        }
    } catch (error) {
        console.error('PR Generation Error:', error);
        alert(`Something went wrong: ${error.message}. Please check if the backend is running on port 5000.`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

/**
 * Editor Settings
 * Sets up word count, download, formatting strip, and keyboard shortcuts.
 */
function setupEditorSettings() {
    const textarea = document.getElementById('prEditorTextarea');
    const downloadBtn = document.getElementById('prDownloadBtn');

    if (!textarea) return;

    // --- Live Word Count ---
    textarea.addEventListener('input', () => updateWordCount(textarea));

    // --- Download ---
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const text = textarea.value;
            if (!text.trim()) {
                alert('Nothing to download yet. Generate a PR description first.');
                return;
            }
            const blob = new Blob([text], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pr-description.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Feedback
            const originalHTML = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-check"></i>';
            downloadBtn.classList.add('success');
            setTimeout(() => {
                downloadBtn.innerHTML = originalHTML;
                downloadBtn.classList.remove('success');
            }, 2000);
        });
    }

    // --- Formatting Strip ---
    setupFormatStrip(textarea);

    // --- Keyboard Shortcuts ---
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                applyFormat(textarea, 'bold');
            } else if (e.key === 'i') {
                e.preventDefault();
                applyFormat(textarea, 'italic');
            } else if (e.key === 'k') {
                e.preventDefault();
                applyFormat(textarea, 'link');
            }
        }
    });
}

/**
 * Formatting Strip
 * Wires up click handlers on each .pr-fmt-btn to apply markdown formatting.
 */
function setupFormatStrip(textarea) {
    const strip = document.getElementById('prFormatStrip');
    if (!strip) return;

    strip.addEventListener('click', (e) => {
        const btn = e.target.closest('.pr-fmt-btn');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action) {
            applyFormat(textarea, action);
            textarea.focus();
        }
    });
}

/**
 * Applies markdown formatting to the textarea based on the action type.
 * Wraps selected text or inserts formatting at the cursor position.
 */
function applyFormat(textarea, action) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let before = '';
    let after = '';
    let insert = '';
    let cursorOffset = 0;

    switch (action) {
        case 'bold':
            before = '**';
            after = '**';
            insert = selected || 'bold text';
            cursorOffset = selected ? 0 : before.length;
            break;
        case 'italic':
            before = '*';
            after = '*';
            insert = selected || 'italic text';
            cursorOffset = selected ? 0 : before.length;
            break;
        case 'strikethrough':
            before = '~~';
            after = '~~';
            insert = selected || 'strikethrough';
            cursorOffset = selected ? 0 : before.length;
            break;
        case 'heading':
            // Add ## at the start of the line
            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const lineText = text.substring(lineStart, end);
            // If line starts with #, add one more
            if (lineText.startsWith('### ')) {
                // Already h3, cycle back to no heading
                textarea.value = text.substring(0, lineStart) + lineText.replace(/^### /, '') + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start - 4;
                textarea.dispatchEvent(new Event('input'));
                return;
            } else if (lineText.startsWith('## ')) {
                textarea.value = text.substring(0, lineStart) + lineText.replace(/^## /, '### ') + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                textarea.dispatchEvent(new Event('input'));
                return;
            } else if (lineText.startsWith('# ')) {
                textarea.value = text.substring(0, lineStart) + lineText.replace(/^# /, '## ') + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                textarea.dispatchEvent(new Event('input'));
                return;
            } else {
                textarea.value = text.substring(0, lineStart) + '## ' + lineText + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 3;
                textarea.dispatchEvent(new Event('input'));
                return;
            }
        case 'code':
            before = '`';
            after = '`';
            insert = selected || 'code';
            cursorOffset = selected ? 0 : before.length;
            break;
        case 'link':
            if (selected) {
                before = '[';
                after = '](url)';
                insert = selected;
            } else {
                insert = '[link text](url)';
                cursorOffset = 1; // place cursor after [
            }
            break;
        case 'ul':
            insert = (selected || 'list item').split('\n').map(line => `- ${line}`).join('\n');
            before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
            after = '';
            break;
        case 'checklist':
            insert = (selected || 'task item').split('\n').map(line => `- [ ] ${line}`).join('\n');
            before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
            after = '';
            break;
        case 'quote':
            insert = (selected || 'quote').split('\n').map(line => `> ${line}`).join('\n');
            before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
            after = '';
            break;
        default:
            return;
    }

    const replacement = before + insert + after;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);

    // Set cursor position
    if (selected) {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + insert.length;
    } else {
        const pos = start + before.length + cursorOffset;
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos + insert.length - cursorOffset;
    }

    textarea.dispatchEvent(new Event('input'));
}

/**
 * Updates the live word/char counter in the header.
 */
function updateWordCount(textarea) {
    const counter = document.getElementById('prWordCount');
    if (!counter) return;

    const text = textarea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    counter.textContent = `${words} word${words !== 1 ? 's' : ''} · ${chars} char${chars !== 1 ? 's' : ''}`;
}

function copyToClipboard(source, copyBtn) {
    const text = source.value !== undefined ? source.value : source.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyBtn.classList.add('success');

        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('success');
        }, 2000);
    }).catch(err => {
        console.error('Clipboard error:', err);
        alert('Failed to copy to clipboard.');
    });
}
