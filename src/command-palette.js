let commandPaletteInitialized = false;

function initCommandPalette() {
  if (commandPaletteInitialized) return true;
  const app = document.querySelector('#app');
  if (!app || !document.querySelector('.topbar')) return false;
  commandPaletteInitialized = true;

  const overlay = document.createElement('div');
  overlay.className = 'sss-command-palette hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Command palette');
  overlay.innerHTML = `
    <div class="sss-command-card">
      <div class="sss-command-search-row">
        <i data-lucide="search" aria-hidden="true"></i>
        <input type="search" data-command-search placeholder="Search commands…" autocomplete="off" spellcheck="false" />
        <kbd>Esc</kbd>
      </div>
      <div class="sss-command-results" data-command-results role="listbox"></div>
      <div class="sss-command-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> run</span>
        <span><kbd>Ctrl</kbd><kbd>K</kbd> open</span>
      </div>
    </div>`;
  document.body.append(overlay);

  const search = overlay.querySelector('[data-command-search]');
  const results = overlay.querySelector('[data-command-results]');
  let commands = [];
  let filtered = [];
  let activeIndex = 0;
  let previousFocus = null;

  const iconRules = [
    [/rigging/i, 'bone'], [/diagnostics/i, 'activity'], [/save|export project/i, 'save'], [/new project/i, 'file-plus-2'],
    [/undo/i, 'undo-2'], [/redo/i, 'redo-2'], [/auto slice|object slice/i, 'scan-line'], [/trim|crop/i, 'crop'],
    [/align/i, 'align-center'], [/gif|webp|animated png|apng/i, 'film'], [/sprite sheet|atlas|aseprite/i, 'images'],
    [/unity/i, 'package'], [/godot|phaser/i, 'gamepad-2'], [/play/i, 'play'], [/demo/i, 'sparkles'],
    [/clear|delete/i, 'trash-2'], [/fullscreen/i, 'maximize-2'], [/back to animator/i, 'arrow-left']
  ];

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function iconFor(label) {
    return iconRules.find(([pattern]) => pattern.test(label))?.[1] || 'command';
  }

  function categoryFor(button) {
    if (button.closest('.export-grid')) return 'Export';
    if (button.closest('.smart-panel')) return 'Smart tools';
    if (button.closest('.rig-overlay')) return 'Rigging';
    if (button.closest('.top-actions')) return 'Project';
    if (button.closest('.timeline')) return 'Timeline';
    return 'Editor';
  }

  function commandId(button, index) {
    return button.id || `command-${index}-${normalizeText(button.textContent).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function collectCommands() {
    const seen = new Set();
    const output = [];
    const buttons = [...document.querySelectorAll('button')].filter((button) => !button.closest('.sss-command-palette'));
    buttons.forEach((button, index) => {
      const label = normalizeText(button.textContent || button.getAttribute('aria-label') || button.title);
      if (!label || label.length > 80) return;
      const id = commandId(button, index);
      const key = `${id}:${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      output.push({
        id,
        label,
        category: categoryFor(button),
        icon: iconFor(label),
        disabled: button.disabled,
        hidden: button.offsetParent === null,
        run() {
          const liveButton = button.id ? document.getElementById(button.id) : button;
          if (!(liveButton instanceof HTMLButtonElement) || liveButton.disabled) return false;
          liveButton.click();
          return true;
        }
      });
    });

    output.push({
      id: 'command-palette-selftest',
      label: 'Open Diagnostics self-test',
      category: 'Developer',
      icon: 'stethoscope',
      disabled: false,
      hidden: false,
      run() {
        globalThis.__SSSDiagnostics?.open?.();
        return Boolean(globalThis.__SSSDiagnostics);
      }
    });

    return output.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
  }

  function score(command, query) {
    const haystack = `${command.label} ${command.category}`.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return 1;
    if (haystack === q) return 100;
    if (haystack.startsWith(q)) return 70;
    if (haystack.includes(q)) return 50;
    let position = 0;
    let points = 0;
    for (const char of q) {
      const found = haystack.indexOf(char, position);
      if (found < 0) return 0;
      points += found === position ? 3 : 1;
      position = found + 1;
    }
    return points;
  }

  function filterCommands() {
    const query = search.value;
    filtered = commands
      .map((command) => ({ command, score: score(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
      .map((entry) => entry.command)
      .slice(0, 30);
    activeIndex = Math.max(0, Math.min(activeIndex, filtered.length - 1));
    render();
  }

  function render() {
    results.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'sss-command-empty';
      empty.textContent = 'No matching commands.';
      results.append(empty);
      return;
    }

    filtered.forEach((command, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `sss-command-row${index === activeIndex ? ' active' : ''}`;
      row.dataset.commandIndex = String(index);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === activeIndex));
      row.disabled = command.disabled;
      row.innerHTML = `
        <span class="sss-command-icon"><i data-lucide="${command.icon}" aria-hidden="true"></i></span>
        <span class="sss-command-copy"><strong></strong><small></small></span>
        ${command.disabled ? '<span class="sss-command-state">disabled</span>' : ''}`;
      row.querySelector('strong').textContent = command.label;
      row.querySelector('small').textContent = command.category;
      row.addEventListener('mouseenter', () => { activeIndex = index; renderSelection(); });
      row.addEventListener('click', () => runCommand(index));
      results.append(row);
    });
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function renderSelection() {
    results.querySelectorAll('.sss-command-row').forEach((row, index) => {
      row.classList.toggle('active', index === activeIndex);
      row.setAttribute('aria-selected', String(index === activeIndex));
    });
    results.querySelector('.sss-command-row.active')?.scrollIntoView({ block: 'nearest' });
  }

  function runCommand(index = activeIndex) {
    const command = filtered[index];
    if (!command || command.disabled) return;
    close();
    setTimeout(() => command.run(), 0);
  }

  function open() {
    previousFocus = document.activeElement;
    commands = collectCommands();
    search.value = '';
    activeIndex = 0;
    overlay.classList.remove('hidden');
    filterCommands();
    requestAnimationFrame(() => search.focus());
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function close() {
    overlay.classList.add('hidden');
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  search.addEventListener('input', () => { activeIndex = 0; filterCommands(); });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      renderSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      renderSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runCommand();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener('keydown', (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (overlay.classList.contains('hidden')) open();
      else close();
      return;
    }
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });

  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const trigger = document.createElement('button');
    trigger.className = 'btn command-palette-trigger';
    trigger.title = 'Command palette (Ctrl/Cmd + K)';
    trigger.innerHTML = '<i data-lucide="command" aria-hidden="true"></i><span>Commands</span><kbd>⌘K</kbd>';
    trigger.addEventListener('click', open);
    topActions.prepend(trigger);
  }

  globalThis.__SSSCommandPalette = { open, close, collect: collectCommands };
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  return true;
}

if (!initCommandPalette()) {
  const timer = window.setInterval(() => {
    if (!initCommandPalette()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
