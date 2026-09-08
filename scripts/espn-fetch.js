#!/usr/bin/env node

/**
 * Shared ESPN/HTTP fetch helper.
 * GitHub Actions runners often get Akamai HTML (403) from site.api.espn.com.
 * Prefer site.web.api.espn.com, which still returns JSON.
 */

const rawFetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.espn.com/'
};

function looksLikeJson(text) {
    const trimmed = (text || '').trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function espnCandidates(url) {
    if (typeof url !== 'string') return [url];
    if (url.includes('site.api.espn.com')) {
        return [
            url.replace('site.api.espn.com', 'site.web.api.espn.com'),
            url
        ];
    }
    if (url.includes('site.web.api.espn.com')) {
        return [url, url.replace('site.web.api.espn.com', 'site.api.espn.com')];
    }
    return [url];
}

function withTimeout(options = {}) {
    const opts = { ...options };
    const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
    opts.headers = headers;

    if (options.timeout && !options.signal) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), options.timeout);
        opts.signal = controller.signal;
        opts.__timeoutHandle = t;
        delete opts.timeout;
    }

    return opts;
}

async function fetchOnce(url, options = {}) {
    const opts = withTimeout(options);
    try {
        return await rawFetch(url, opts);
    } finally {
        if (opts.__timeoutHandle) clearTimeout(opts.__timeoutHandle);
    }
}

async function fetchJson(url, options = {}) {
    const retries = options.retries ?? 2;
    const urls = espnCandidates(url);

    let lastError;
    for (const candidate of urls) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetchOnce(candidate, options);
                const text = await response.text();
                if (!response.ok || !looksLikeJson(text)) {
                    lastError = new Error(
                        `HTTP ${response.status} non-JSON from ${candidate}: ${(text || '').slice(0, 120).replace(/\s+/g, ' ')}`
                    );
                } else {
                    return JSON.parse(text);
                }
            } catch (error) {
                lastError = error;
            }
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
    }
    throw lastError;
}

async function fetch(url, options = {}) {
    const urls = espnCandidates(url);
    let lastError;
    let lastText = '';
    let lastResponse = null;

    for (const candidate of urls) {
        try {
            const response = await fetchOnce(candidate, options);
            const text = await response.text();
            lastResponse = response;
            lastText = text;
            if (response.ok && looksLikeJson(text)) {
                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    url: response.url,
                    text: async () => text,
                    json: async () => JSON.parse(text)
                };
            }
            lastError = new Error(
                `HTTP ${response.status} non-JSON from ${candidate}: ${(text || '').slice(0, 120).replace(/\s+/g, ' ')}`
            );
        } catch (error) {
            lastError = error;
        }
    }

    if (lastResponse) {
        const text = lastText;
        return {
            ok: lastResponse.ok,
            status: lastResponse.status,
            statusText: lastResponse.statusText,
            headers: lastResponse.headers,
            url: lastResponse.url,
            text: async () => text,
            json: async () => {
                if (!looksLikeJson(text)) {
                    throw lastError || new Error(`Non-JSON response from ${url}`);
                }
                return JSON.parse(text);
            }
        };
    }

    throw lastError;
}

function currentNflSeasonYear(date = new Date()) {
    const month = date.getMonth();
    return month < 8 ? date.getFullYear() - 1 : date.getFullYear();
}

module.exports = {
    fetch,
    fetchJson,
    currentNflSeasonYear,
    DEFAULT_HEADERS
};
