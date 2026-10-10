/* Mobile friendly code editor: line numbers + syntax highlighting over a real <textarea>. */
(function () {
  const KEYS = [['⇥', '    '], ['( )', '()', 1], ['[ ]', '[]', 1], ['{ }', '{}', 1], ['" "', '""', 1], [':', ':'], ['=', '='], ['#', '#'],
    ['_', '_'], ['+', '+'], ['-', '-'], ['*', '*'], ['/', '/'], ['<', '<'], ['>', '>'], ['.', '.'], [',', ',']];

  window.createEditor = function (host, opts) {
    opts = opts || {};
    host.innerHTML = '<div class="ed" style="--h:' + (opts.height || 260) + 'px"><div class="ed-gut"><pre></pre></div>' +
      '<div class="ed-body"><pre class="ed-hl" aria-hidden="true"></pre>' +
      '<textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Python"></textarea></div></div>' +
      (opts.keys === false ? '' : '<div class="keys">' + KEYS.map((k, i) => '<button type="button" data-k="' + i + '">' + PT.escapeHtml(k[0]) + '</button>').join('') + '</div>');
    const ta = host.querySelector('textarea');
    const hl = host.querySelector('.ed-hl');
    const gut = host.querySelector('.ed-gut pre');
    let onChange = opts.onChange || function () {};

    function paint() {
      const v = ta.value;
      hl.innerHTML = PT.highlight(v) + '\n ';
      const n = v.split('\n').length;
      let g = '';
      for (let i = 1; i <= n; i++) g += i + '\n';
      gut.textContent = g;
      sync();
    }
    function sync() {
      hl.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
      gut.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    }
    function insert(text, caretBack) {
      ta.focus();
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
      const pos = s + text.length - (caretBack || 0);
      ta.selectionStart = ta.selectionEnd = pos;
      paint(); onChange(ta.value);
    }
    ta.addEventListener('input', () => { paint(); onChange(ta.value); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab') { ev.preventDefault(); insert('    '); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        const s = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
        insert('\n' + PT.nextIndent(ta.value.slice(lineStart, s)));
      } else if (ev.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
        const s = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
        const before = ta.value.slice(lineStart, s);
        if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0) {
          ev.preventDefault();
          ta.value = ta.value.slice(0, s - 4) + ta.value.slice(s);
          ta.selectionStart = ta.selectionEnd = s - 4;
          paint(); onChange(ta.value);
        }
      }
    });
    const keys = host.querySelector('.keys');
    if (keys) {
      keys.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus & keyboard
      keys.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-k]');
        if (!b) return;
        const k = KEYS[Number(b.dataset.k)];
        insert(k[1], k[2] ? 1 : 0);
      });
    }
    ta.value = opts.value || '';
    paint();
    return {
      getValue: () => ta.value,
      setValue(v) { ta.value = v; paint(); onChange(v); },
      focus: () => ta.focus(),
      onChange(fn) { onChange = fn; },
    };
  };
})();
