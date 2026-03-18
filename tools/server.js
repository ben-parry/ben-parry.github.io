const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Load config
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('Error: config.json not found. Copy config.example.json to config.json and fill in your credentials.');
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const PORT = 3847;
const REPO_ROOT = path.join(__dirname, '..');

// OAuth 1.0a signature generation for X API
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
    const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method, url, extraParams = {}) {
    const oauthParams = {
        oauth_consumer_key: config.x.apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: config.x.accessToken,
        oauth_version: '1.0',
        ...extraParams
    };

    const allParams = { ...oauthParams };
    const signature = generateOAuthSignature(method, url, allParams, config.x.apiKeySecret, config.x.accessTokenSecret);
    oauthParams.oauth_signature = signature;

    const headerParams = Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(', ');
    return `OAuth ${headerParams}`;
}

// Post to X (Twitter) - supports text and images
async function postToX(text, imageUrls = []) {
    // If there are images, upload them first
    let mediaIds = [];

    for (const imageUrl of imageUrls.slice(0, 4)) { // Max 4 images
        try {
            const mediaId = await uploadMediaToX(imageUrl);
            if (mediaId) mediaIds.push(mediaId);
        } catch (err) {
            console.error('Failed to upload image:', imageUrl, err.message);
        }
    }

    // Create the tweet
    const url = 'https://api.twitter.com/2/tweets';
    const body = { text };

    if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
    }

    return new Promise((resolve, reject) => {
        const authHeader = generateOAuthHeader('POST', url);
        const postData = JSON.stringify(body);

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`X API error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Upload media to X (Twitter) v1.1 API
async function uploadMediaToX(imageUrl) {
    // First, download the image
    const imageData = await downloadImage(imageUrl);
    const base64Image = imageData.toString('base64');

    const url = 'https://upload.twitter.com/1.1/media/upload.json';

    return new Promise((resolve, reject) => {
        const params = { media_data: base64Image };
        const authHeader = generateOAuthHeader('POST', url, params);

        const postData = `media_data=${encodeURIComponent(base64Image)}`;

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const result = JSON.parse(data);
                    resolve(result.media_id_string);
                } else {
                    reject(new Error(`Media upload error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Download image from URL
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                downloadImage(res.headers.location).then(resolve).catch(reject);
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Generate essay HTML file
function generateEssayHtml(title, content, date, images = []) {
    const imagesHtml = images.length > 0
        ? `<div class="essay-images">${images.map(img => `<img src="${img}" alt="">`).join('\n                        ')}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | Benjamin Parry</title>
    <link rel="stylesheet" href="../styles.css">
    <script src="../nav.js"></script>
</head>
<body>
    <div class="container">
        <div id="menu" class="column left">
            <!-- Menu will be populated by nav.js -->
        </div>

        <div class="column middle">
            <div class="content">
                <article class="essay-post">
                    <header class="blog-post-header">
                        <h2>${escapeHtml(title)}</h2>
                        <p class="blog-post-date">${date}</p>
                    </header>
                    <div class="blog-post-content">
                        ${contentToHtml(content)}
                        ${imagesHtml}
                    </div>
                </article>

                <div class="blog-post-footer">
                    <a href="../essays.html">&larr; Back to all essays</a>
                </div>
            </div>
        </div>

        <div class="column right">
            <!-- Right column, can be left empty as in the index page -->
        </div>
    </div>
</body>
</html>
`;
}

// Convert plain text content to HTML paragraphs
function contentToHtml(content) {
    return content.split('\n\n')
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('\n                        ');
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Generate slug from title
function slugify(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60);
}

// Format date
function formatDate(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(date);
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Update essays.html index
function updateEssaysIndex(title, slug, date) {
    const indexPath = path.join(REPO_ROOT, 'essays.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    const newRow = `<tr class="blog-row">
                                <td class="blog-title"><a href="essays/${slug}.html">${escapeHtml(title)}</a></td>
                                <td class="blog-date">${date}</td>
                            </tr>
                            <!-- Essay rows will be added here by the tool -->`;

    html = html.replace('<!-- Essay rows will be added here by the tool -->', newRow);
    fs.writeFileSync(indexPath, html);
}

// Commit and push to GitHub
function commitAndPush(title) {
    try {
        execSync('git add .', { cwd: REPO_ROOT, stdio: 'pipe' });
        execSync(`git commit -m "Add essay: ${title.replace(/"/g, '\\"')}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
        execSync('git push', { cwd: REPO_ROOT, stdio: 'pipe' });
        return true;
    } catch (err) {
        console.error('Git error:', err.message);
        return false;
    }
}

// Main request handler
async function handleRequest(req, res) {
    // CORS headers for bookmarklet
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/publish') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { title, content, images = [] } = data;

                if (!title || !content) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing title or content' }));
                    return;
                }

                console.log(`\n📝 Publishing essay: "${title}"`);

                const slug = slugify(title);
                const date = formatDate(new Date());
                const fullText = `${title}\n\n${content}`;

                // 1. Post to X
                console.log('  → Posting to X...');
                try {
                    const tweet = await postToX(fullText, images);
                    console.log(`  ✓ Posted to X: https://twitter.com/i/status/${tweet.data.id}`);
                } catch (err) {
                    console.error(`  ✗ X error: ${err.message}`);
                }

                // 2. Generate essay HTML
                console.log('  → Generating essay page...');
                const essayHtml = generateEssayHtml(title, content, date, images);
                const essayPath = path.join(REPO_ROOT, 'essays', `${slug}.html`);
                fs.writeFileSync(essayPath, essayHtml);
                console.log(`  ✓ Created: essays/${slug}.html`);

                // 3. Update index
                console.log('  → Updating essays index...');
                updateEssaysIndex(title, slug, date);
                console.log('  ✓ Updated essays.html');

                // 4. Commit and push
                console.log('  → Pushing to GitHub...');
                if (commitAndPush(title)) {
                    console.log('  ✓ Pushed to GitHub');
                } else {
                    console.log('  ✗ Git push failed (you may need to push manually)');
                }

                console.log('✅ Done!\n');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    essayUrl: `https://www.benparry.ca/essays/${slug}.html`
                }));

            } catch (err) {
                console.error('Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
}

// Start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`\n🚀 Essay publisher running at http://localhost:${PORT}`);
    console.log('\nBookmarklet ready! When you click it on a Substack Note,');
    console.log('it will automatically:');
    console.log('  1. Post to X (Twitter)');
    console.log('  2. Create essay page on your website');
    console.log('  3. Update the essays index');
    console.log('  4. Push to GitHub\n');
});
