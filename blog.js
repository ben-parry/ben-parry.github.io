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
                        <td class="blog-date">${formatDate(new Date(post.date))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
}

async function renderBlogPost(slug) {
    const container = document.getElementById('blog-post');
    if (!container) return;

    try {
        const response = await fetch(`posts/${encodeURIComponent(slug)}.json`);
        if (!response.ok) throw new Error('Not found');
        const post = await response.json();

        document.title = `${post.title} | Benjamin Parry`;

        container.innerHTML = `
            <header class="blog-post-header">
                <h2>${post.title}</h2>
                <p class="blog-post-date">${formatDate(new Date(post.date))}</p>
            </header>
            <div class="blog-post-content">
                ${post.content}
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<p>Post not found.</p>';
        document.title = 'Post Not Found | Benjamin Parry';
    }
}

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (postSlug) {
        await renderBlogPost(postSlug);
    } else if (document.getElementById('blog-posts')) {
        try {
            const response = await fetch('posts/index.json');
            if (!response.ok) throw new Error('Failed to load posts');
            const posts = await response.json();
            renderBlogList(posts);
        } catch (e) {
            const container = document.getElementById('blog-posts');
            if (container) {
                container.innerHTML = '<p>Unable to load posts.</p>';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
