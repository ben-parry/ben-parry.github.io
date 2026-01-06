const SUBSTACK_RSS_URL = 'https://benparry.substack.com/feed';

async function fetchRSSFeed() {
    // Try multiple CORS proxies in case one fails
    const corsProxies = [
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url) => `https://cors-anywhere.herokuapp.com/${url}`
    ];

    for (const proxyFn of corsProxies) {
        try {
            const proxyUrl = proxyFn(SUBSTACK_RSS_URL);
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;

            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            // Check if parsing was successful
            if (xml.querySelector('parsererror')) continue;

            return xml;
        } catch (error) {
            console.warn('Proxy failed, trying next:', error);
            continue;
        }
    }

    console.error('All CORS proxies failed');
    return null;
}

function parseRSSItems(xml) {
    const items = xml.querySelectorAll('item');
    const posts = [];

    items.forEach(item => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const content = item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0]?.textContent || description;

        // Create a slug from the Substack URL
        const slug = link.split('/p/')[1]?.split('?')[0] || '';

        posts.push({
            title,
            link,
            slug,
            pubDate: new Date(pubDate),
            description,
            content
        });
    });

    return posts;
}

function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function renderBlogList(posts) {
    const container = document.getElementById('blog-posts');
    if (!container) return;

    if (posts.length === 0) {
        container.innerHTML = '<p>No posts found.</p>';
        return;
    }

    const tableHtml = `
        <table class="blog-table">
            <tbody>
                ${posts.map(post => `
                    <tr class="blog-row">
                        <td class="blog-title">
                            <a href="blog-post.html?post=${encodeURIComponent(post.slug)}">${post.title}</a>
                        </td>
                        <td class="blog-date">${formatDate(post.pubDate)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
}

function renderBlogPost(posts, slug) {
    const container = document.getElementById('blog-post');
    if (!container) return;

    const post = posts.find(p => p.slug === slug);

    if (!post) {
        container.innerHTML = '<p>Post not found.</p>';
        document.title = 'Post Not Found | Benjamin Parry';
        return;
    }

    document.title = `${post.title} | Benjamin Parry`;

    container.innerHTML = `
        <header class="blog-post-header">
            <h2>${post.title}</h2>
            <p class="blog-post-date">${formatDate(post.pubDate)}</p>
        </header>
        <div class="blog-post-content">
            ${post.content}
        </div>
    `;
}

async function init() {
    const xml = await fetchRSSFeed();
    if (!xml) {
        const container = document.getElementById('blog-posts') || document.getElementById('blog-post');
        if (container) {
            container.innerHTML = '<p>Unable to load posts. Please try again later.</p>';
        }
        return;
    }

    const posts = parseRSSItems(xml);

    // Check if we're on the blog list page or a single post page
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (postSlug) {
        renderBlogPost(posts, postSlug);
    } else if (document.getElementById('blog-posts')) {
        renderBlogList(posts);
    }
}

document.addEventListener('DOMContentLoaded', init);
