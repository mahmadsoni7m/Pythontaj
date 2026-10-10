/* Original artwork: mascot "Тоҷ" (a friendly snake wearing a crown — "тоҷ" means crown), onboarding scenes, confetti. */
(function () {
  let uid = 0;
  function mascot(opts) {
    opts = opts || {};
    const id = 'mg' + (++uid), mood = opts.mood || 'happy';
    const mouth = mood === 'cheer'
      ? '<path d="M64 76 Q78 98 92 76 Z" fill="#2A1550"/><path d="M70 86 Q78 92 86 86" fill="#FF7A9C" stroke="none"/>'
      : '<path d="M64 76 Q78 88 92 76" fill="none" stroke="#2A1550" stroke-width="4" stroke-linecap="round"/>';
    return '<svg class="' + (opts.cls || '') + '" viewBox="0 0 170 190" role="img" aria-label="Тоҷ"><defs>' +
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9D80FF"/><stop offset="1" stop-color="#FF7AB8"/></linearGradient>' +
      '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE07A"/><stop offset="1" stop-color="#FFB020"/></linearGradient></defs>' +
      '<path d="M100 84 C150 94 150 140 100 146 C54 152 38 170 72 178 L128 178" fill="none" stroke="url(#' + id + ')" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M104 96 C138 104 138 132 104 136" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="7" stroke-linecap="round"/>' +
      '<ellipse cx="80" cy="66" rx="44" ry="37" fill="url(#' + id + ')"/>' +
      '<ellipse cx="64" cy="48" rx="16" ry="9" fill="#fff" fill-opacity=".2" transform="rotate(-20 64 48)"/>' +
      '<circle cx="63" cy="62" r="11" fill="#fff"/><circle cx="97" cy="62" r="11" fill="#fff"/>' +
      '<circle cx="66" cy="64" r="5.5" fill="#2A1550"/><circle cx="94" cy="64" r="5.5" fill="#2A1550"/>' +
      '<circle cx="68" cy="61.5" r="2" fill="#fff"/><circle cx="96" cy="61.5" r="2" fill="#fff"/>' +
      '<circle cx="50" cy="78" r="6" fill="#FF5FA2" fill-opacity=".45"/><circle cx="110" cy="78" r="6" fill="#FF5FA2" fill-opacity=".45"/>' +
      mouth +
      '<path d="M52 36 L58 12 L70 26 L80 6 L90 26 L102 12 L108 36 Z" fill="url(#' + id + 'c)" stroke="#E69A00" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="58" cy="12" r="4" fill="#FF6FB5"/><circle cx="80" cy="6" r="4.5" fill="#7C5CFF"/><circle cx="102" cy="12" r="4" fill="#35E0A1"/></svg>';
  }

  const icn = (n) => window.icon(n);
  const scenes = [
    // 1: mascot + floating code tags
    () => '<div class="glow"></div><div class="float" style="width:210px;position:relative;z-index:1">' + mascot({ mood: 'cheer' }) + '</div>' +
      '<span class="tag float2" style="left:2%;top:14%;color:var(--green)">print()</span><span class="tag float" style="right:0;top:30%;color:var(--pink)">{ }</span>' +
      '<span class="tag float2" style="left:8%;bottom:10%;color:var(--gold)"># Python</span>',
    // 2: stacked lesson cards
    () => '<div class="glow"></div><div class="mock float" style="z-index:1"><div class="row"><span class="chip p">Дарси 1</span><span class="chip g">✓</span></div>' +
      '<div class="ln a"></div><div class="ln c"></div><div class="ln"></div><div class="ln d"></div></div>' +
      '<div class="mock float2" style="position:absolute;transform:translate(26px,86px) rotate(5deg);opacity:.55"><div class="ln c"></div><div class="ln b"></div></div>',
    // 3: code window
    () => '<div class="glow"></div><div class="win float" style="width:270px;margin:0;z-index:1"><div class="bar2"><i></i><i></i><i></i><span>main.py</span></div>' +
      '<pre class="code" style="font-size:14px">' + PT.highlight('name = "Тоҷ"\nprint("Салом,", name)') + '</pre>' +
      '<pre class="out" style="margin:0 12px 12px">Салом, Тоҷ</pre></div>',
    // 4: trophy + flame + star
    () => '<div class="glow"></div><div class="float" style="z-index:1;width:150px;height:150px;border-radius:44px;display:grid;place-items:center;background:var(--grad);box-shadow:0 20px 50px rgba(124,92,255,.5);color:#fff">' +
      icn('trophy').replace('class="i ', 'style="width:80px;height:80px" class="i ') + '</div>' +
      '<span class="tag float2" style="left:6%;top:18%;color:#FF9A3D">' + icn('flame') + '</span><span class="tag float" style="right:4%;top:44%;color:var(--gold)">' + icn('star') + '</span>' +
      '<span class="tag float2" style="left:12%;bottom:12%;color:var(--green)">+20 XP</span>',
    // 5: offline
    () => '<div class="glow"></div><div class="float" style="z-index:1;width:150px;height:150px;border-radius:44px;display:grid;place-items:center;background:var(--s2);border:1px solid var(--line);color:var(--green)">' +
      icn('download').replace('class="i ', 'style="width:76px;height:76px" class="i ') + '</div>' +
      '<span class="tag float2" style="right:6%;top:16%;color:var(--muted)">' + icn('wifioff') + '</span><span class="tag float" style="left:4%;bottom:16%;color:var(--green)">42 ' + I18N.t('lessons_word') + '</span>',
  ];

  function confetti() {
    if (!window.requestAnimationFrame || window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const c = document.createElement('canvas');
    const W = (c.width = innerWidth), H = (c.height = innerHeight), x = c.getContext('2d');
    if (!x) return null;
    const cols = ['#7C5CFF', '#B05CFF', '#FF6FB5', '#FFC53D', '#35E0A1', '#4DA3FF'];
    const ps = Array.from({ length: 110 }, () => ({ x: W / 2, y: H * 0.38, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] }));
    let t0 = null;
    (function tick(t) {
      if (t0 === null) t0 = t;
      x.clearRect(0, 0, W, H);
      ps.forEach((p) => { p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); x.restore(); });
      if (t - t0 < 2600 && c.isConnected !== false) requestAnimationFrame(tick); else c.remove();
    })(0);
    return c;
  }
  window.Art = { mascot, scene: (i) => scenes[i](), confetti };
})();
