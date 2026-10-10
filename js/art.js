/* New artwork: mascot "Тоҷ" 3D Duolingo-style with blink + float - pro */
(function () {
  function mascot(opts) {
    opts = opts || {};
    const cls = opts.cls || '';
    const extra = opts.hero ? ' toj-hero' : (opts.center ? ' toj-center' : ' toj-float');
    // wrapper enables blink + float without breaking layout
    return '<div class="toj-wrap ' + extra + ' ' + cls + '" style="' + (opts.wrapStyle||'') + '">'
      + '<img class="toj-img" src="./assets/toj.png" alt="Тоҷ" loading="eager">'
      + '<span class="toj-eyelid toj-eyelid-l"></span><span class="toj-eyelid toj-eyelid-r"></span>'
      + '</div>';
  }

  const icn = (n) => window.icon ? window.icon(n) : '';
  const scenes = [
    // 1: hero - onboarding
    () => '<div class="glow"></div><div class="float" style="width:220px;position:relative;z-index:1">' + mascot({}) + '</div>'
      + '<span class="tag float2" style="left:2%;top:14%;color:var(--green)">print()</span><span class="tag float" style="right:0;top:30%;color:#8A7CFF">{ }</span>'
      + '<span class="tag float2" style="left:8%;bottom:10%;color:var(--gold)"># Python</span>',
    () => '<div class="glow"></div><div class="mock float" style="z-index:1"><div class="row"><span class="chip p">Дарси 1</span><span class="chip g">✓</span></div><div class="ln a"></div><div class="ln c"></div><div class="ln"></div><div class="ln d"></div></div><div class="mock float2" style="position:absolute;transform:translate(26px,86px) rotate(5deg);opacity:.55"><div class="ln c"></div><div class="ln b"></div></div>',
    () => '<div class="glow"></div><div class="win float" style="width:270px;margin:0;z-index:1"><div class="bar2"><i></i><i></i><i></i><span>main.py</span></div><pre class="code" style="font-size:14px">' + (window.PT && PT.highlight ? PT.highlight('name = "Тоҷ"\nprint("Салом,", name)') : 'name = "Тоҷ"\nprint("Салом,", name)') + '</pre><pre class="out" style="margin:0 12px 12px">Салом, Тоҷ</pre></div>',
    () => '<div class="glow"></div><div class="float" style="z-index:1;width:150px;height:150px;border-radius:44px;display:grid;place-items:center;background:linear-gradient(135deg,#5B4CFF,#6E5CFF);box-shadow:0 20px 50px rgba(94,92,255,.5);color:#fff">' + icn('trophy').replace('class="i ', 'style="width:80px;height:80px" class="i ') + '</div><span class="tag float2" style="left:6%;top:18%;color:#FF9A3D">' + icn('flame') + '</span><span class="tag float" style="right:4%;top:44%;color:var(--gold)">' + icn('star') + '</span><span class="tag float2" style="left:12%;bottom:12%;color:var(--green)">+20 XP</span>',
    () => '<div class="glow"></div><div class="float" style="z-index:1;width:150px;height:150px;border-radius:44px;display:grid;place-items:center;background:var(--s2);border:1px solid var(--line);color:var(--green)">' + icn('download').replace('class="i ', 'style="width:76px;height:76px" class="i ') + '</div><span class="tag float2" style="right:6%;top:16%;color:var(--muted)">' + icn('wifioff') + '</span><span class="tag float" style="left:4%;bottom:16%;color:var(--green)">42 ' + (window.I18N ? I18N.t('lessons_word') : 'дарс') + '</span>',
  ];

  // helper for home hero card (called from app.js)
  function heroCardArt(){
    return mascot({hero:true, wrapStyle:'width:132px;'});
  }

  function confetti() {
    if (!window.requestAnimationFrame || window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const c = document.createElement('canvas'); const W = (c.width = innerWidth), H = (c.height = innerHeight), x = c.getContext('2d'); if (!x) return null;
    const cols = ['#6E5CFF', '#7C5CFF', '#8A7CFF', '#FFC53D', '#35E0A1', '#4DA3FF'];
    const ps = Array.from({ length: 110 }, () => ({ x: W / 2, y: H * 0.38, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] }));
    let t0 = null; (function tick(t) { if (t0 === null) t0 = t; x.clearRect(0, 0, W, H); ps.forEach((p) => { p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); x.restore(); }); if (t - t0 < 2600 && c.isConnected !== false) requestAnimationFrame(tick); else c.remove(); })(0); return c;
  }
  window.Art = { mascot, heroCardArt, scene: (i) => scenes[i](), confetti };
})();
                                                                                
