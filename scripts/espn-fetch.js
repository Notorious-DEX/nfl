#!/usr/bin/env node

/**
 * Shared ESPN/HTTP fetch helper.
 * GitHub Actions runners often get Akamai HTML (403) from site.api.espn.com.
 * That makes response.json() throw: Unexpected token < in JSON at position 0.
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

function alternateEspnUrl(url) {
    if (typeof url !== 'string') return null;
    if (url.includes('site.api.espn.com')) {
        return url.replace('site.api.espn.com', 'site.web.api.espn.com');
    }
    if (url.includes('site.web.api.espn.com')) {
        return url.replace('site.web.api.espn.com', 'site.api.espn.com');
    }
    return null;
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
    const retries = options.retries ?? 3;
    const urls = [url];
    const alt = alternateEspnUrl(url);
    if (alt) urls.push(alt);

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
            await new Promise(resolve => setTimeout(resolve, 400 * attempt));
        }
    }
    throw lastError;
}

/**
 * Drop-in replacement for node-fetch that:
 * - sends browser-like headers
 * - makes .json() fail with a clear error instead of "Unexpected token <"
 */
async function fetch(url, options = {}) {
    const urls = [url];
    const alt = alternateEspnUrl(url);
    if (alt) urls.push(alt);

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
    // NFL season year is the calendar year the regular season starts (Sep).
    // Jan–Jul still belong to the previous season (playoffs / offseason).
    const month = date.getMonth();
    return month < 8 ? date.getFullYear() - 1 : date.getFullYear();
}

module.exports = {
    fetch,
    fetchJson,
    currentNflSeasonYear,
    DEFAULT_HEADERS
};
