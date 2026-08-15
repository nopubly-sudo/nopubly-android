require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache for demo purposes
// In production, use Redis or a Database
const reputationCache = new Map();

/**
 * GET /api/reputation/:hash
 * Proxies VirusTotal API and caches results
 */
app.get('/api/reputation/:hash', async (req, res) => {
    const { hash } = req.params;

    // 1. Check Cache
    if (reputationCache.has(hash)) {
        console.log(`[CACHE HIT] Returning results for ${hash}`);
        return res.json(reputationCache.get(hash));
    }

    try {
        console.log(`[CACHE MISS] Querying VirusTotal for ${hash}`);
        const response = await axios.get(`https://www.virustotal.com/api/v3/files/${hash}`, {
            headers: {
                'x-apikey': process.env.VIRUSTOTAL_API_KEY
            }
        });

        const stats = response.data.data.attributes.last_analysis_stats;
        const result = {
            malicious: stats.malicious,
            suspicious: stats.suspicious,
            positives: stats.malicious + stats.suspicious,
            timestamp: new Date().toISOString()
        };

        // 2. Save to Cache
        reputationCache.set(hash, result);

        res.json(result);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // File not found on VT
            return res.json({ positives: 0, status: 'NOT_FOUND' });
        }

        console.error('[ERROR] Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch reputation', details: error.message });
    }
});

/**
 * Health Check
 */
/**
 * POST /api/logs
 * Receives error logs and crashes from the mobile app
 */
app.post('/api/logs', (req, res) => {
    const log = {
        ...req.body,
        serverTimestamp: new Date().toISOString()
    };

    // In production, write to a file or a database (MongoDB/ElasticSearch)
    console.error(`[CRASH REPORT] from ${log.deviceName || 'unknown'}:`, log.error);

    // For now, we'll keep a simple local file log
    const fs = require('fs');
    const logEntry = JSON.stringify(log) + '\n';
    fs.appendFileSync('production_errors.log', logEntry);

    res.status(201).json({ status: 'Logged' });
});

app.listen(PORT, () => {
    console.log(`🚀 Nopubly Security Proxy running on http://localhost:${PORT}`);
});
