let shortcutEditorInitialized = false;

function initShortcutEditor() {
  if (shortcutEditorInitialized) return true;
  const palette = globalThis.__SSSCommandPalette;
  const topActions = document.querySelector('.top-actions');
  if (!palette?.collect || !(topActions instanceof HTMLElement)) return false;
  shortcutEditorInitialized = true;

  const STORAGE_KEY = 'sss-custom-shortcuts-v1';
  let bindings = [];
  let recording = false;
  let recordedCombo = '';

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) bindings = parsed.filter((item) => item && item.commandId && item.combo).map((item) => ({
        id: String(item.id || crypto.randomUUID?.() || Math.random()),
        commandId: String(item.commandId),
        label: String(item.label || item.commandId),
        combo: String(item.combo)
      }));
    } catch { bindings = []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings)); } catch {}
  }

  const trigger = document.createElement('button');
  trigger.className = 'btn shortcut-editor-trigger';
  trigger.title = 'Edit custom keyboard shortcuts';
  trigger.innerHTML = '<i data-lucide="keyboard" aria-hidden="true"></i><span>Shortcuts</span>';
  topActions.prepend(trigger);

  const modal = document.createElement('div');
  modal.className = 'sss-shortcuts-modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Keyboard shortcut editor');
  modal.innerHTML = `
    <div class="sss-shortcuts-card">
      <div class="sss-shortcuts-head">
        <div><strong>Keyboard shortcuts</strong><small>custom local bindings</small></div>
        <button class="btn" data-shortcuts-close>Close</button>
      </div>
      <div class="sss-shortcut-create">
        <label><span>Command</span><select data-shortcut-command></select></label>
        <label><span>Shortcut</span><button class="btn shortcut-record" data-shortcut-record>Record keys</button></label>
        <button class="btn green" data-shortcut-add disabled>Add binding</button>
      </div>
      <div class="sss-shortcut-hint">Press Record keys, then type the combination. <b>Ctrl/Cmd+K</b> stays reserved for Command Palette.</div>
      <div class="sss-shortcut-list" data-shortcut-list></div>
      <div class="sss-shortcuts-footer">
        <span data-shortcut-count>0 custom shortcuts</span>
        <button class="btn danger" data-shortcut-clear>Clear all</button>
      </div>
    </div>`;
  document.body.append(modal);

  const commandSelect = modal.querySelector('[data-shortcut-command]');
  const recordBtn = modal.querySelector('[data-shortcut-record]');
  const addBtn = modal.querySelector('[data-shortcut-add]');
  const list = modal.querySelector('[data-shortcut-list]');
  const count = modal.querySelector('[data-shortcut-count]');
  const clearBtn = modal.querySelector('[data-shortcut-clear]');

  function commands() {
    return palette.collect().filter((command) => command.id && !command.disabled);
  }

  function populateCommands() {
    const current = commandSelect.value;
    const items = commands();
    commandSelect.innerHTML = '';
    items.forEach((command) => {
      const option = document.createElement('option');
      option.value = command.id;
      option.textContent = `${command.category} · ${command.label}`;
      option.dataset.label = command.label;
      commandSelect.append(option);
    });
    if (items.some((command) => command.id === current)) commandSelect.value = current;
  }

  function canonicalCombo(event) {
    const key = event.key;
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return '';
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.metaKey) parts.push('Meta');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    let normalized = key.length === 1 ? key.toUpperCase() : key;
    if (normalized === ' ') normalized = 'Space';
    parts.push(normalized);
    return parts.join('+');
  }

  function isReserved(combo) {
    return combo === 'Ctrl+K' || combo === 'Meta+K';
  }

  function render() {
    list.innerHTML = '';
    count.textContent = `${bindings.length} custom shortcut${bindings.length === 1 ? '' : 's'}`;
    if (!bindings.length) {
      const empty = document.createElement('div');
      empty.className = 'sss-shortcut-empty';
      empty.textContent = 'No custom shortcuts yet.';
      list.append(empty);
      return;
    }

    bindings.forEach((binding) => {
      const row = document.createElement('div');
      row.className = 'sss-shortcut-row';
      row.innerHTML = `
        <span class="sss-shortcut-icon"><i data-lucide="command" aria-hidden="true"></i></span>
        <span class="sss-shortcut-copy"><strong></strong><small></small></span>
        <kbd></kbd>
        <button class="btn icon" type="button" title="Delete shortcut"><i data-lucide="trash-2" aria-hidden="true"></i></button>`;
      row.querySelector('strong').textContent = binding.label;
      row.querySelector('small').textContent = binding.commandId;
      row.querySelector('kbd').textContent = binding.combo;
      row.querySelector('button').addEventListener('click', () => {
        bindings = bindings.filter((item) => item.id !== binding.id);
        save();
        render();
      });
      list.append(row);
    });
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function resetRecorder() {
    recording = false;
    recordedCombo = '';
    recordBtn.textContent = 'Record keys';
    recordBtn.classList.remove('recording');
    addBtn.disabled = true;
  }

  function open() {
    populateCommands();
    resetRecorder();
    render();
    modal.classList.remove('hidden');
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function close() {
    recording = false;
    modal.classList.add('hidden');
  }

  function execute(binding) {
    const available = palette.collect().find((command) => command.id === binding.commandId);
    if (available && !available.disabled) return available.run();
    const button = document.getElementById(binding.commandId);
    if (button instanceof HTMLButtonElement && !button.disabled && button.offsetParent !== null) {
      button.click();
      return true;
    }
    return false;
  }

  trigger.addEventListener('click', open);
  modal.querySelector('[data-shortcuts-close]').addEventListener('click', close);
  modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
  recordBtn.addEventListener('click', () => {
    recording = true;
    recordedCombo = '';
    recordBtn.textContent = 'Press combination…';
    recordBtn.classList.add('recording');
    addBtn.disabled = true;
    recordBtn.focus();
  });

  addBtn.addEventListener('click', () => {
    if (!recordedCombo || isReserved(recordedCombo)) return;
    const command = commands().find((item) => item.id === commandSelect.value);
    if (!command) return;
    bindings = bindings.filter((item) => item.combo !== recordedCombo && item.commandId !== command.id);
    bindings.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, commandId: command.id, label: command.label, combo: recordedCombo });
    save();
    render();
    resetRecorder();
  });

  clearBtn.addEventListener('click', () => {
    bindings = [];
    save();
    render();
    resetRecorder();
  });

  document.addEventListener('keydown', (event) => {
    const combo = canonicalCombo(event);
    if (!combo) return;

    if (recording) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isReserved(combo)) {
        recordedCombo = '';
        recordBtn.textContent = `${combo} is reserved`;
        addBtn.disabled = true;
        return;
      }
      recordedCombo = combo;
      recordBtn.textContent = combo;
      recordBtn.classList.remove('recording');
      recording = false;
      addBtn.disabled = false;
      return;
    }

    const binding = bindings.find((item) => item.combo === combo);
    if (!binding) return;
    const target = event.target;
    const typing = target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
    if (typing && !hasModifier) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    execute(binding);
  }, true);

  load();
  render();
  globalThis.__SSSCustomShortcuts = { get: () => bindings.map((item) => ({ ...item })), open, clear() { bindings = []; save(); render(); } };
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  return true;
}

if (!initShortcutEditor()) {
  const timer = window.setInterval(() => {
    if (!initShortcutEditor()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
