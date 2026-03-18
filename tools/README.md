# Essay Publisher Tool

One-click publishing from Substack Notes to X and your website.

## Setup

### 1. Create config.json

Copy the example config and fill in your credentials:

```bash
cp config.example.json config.json
```

### 2. Get X (Twitter) API Credentials

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new Project and App (or use existing)
3. In your App settings, go to "Keys and tokens"
4. Generate:
   - API Key and Secret (Consumer Keys)
   - Access Token and Secret
5. Make sure your app has **Read and Write** permissions
6. Add these to your `config.json`

### 3. Set up GitHub Authentication

The tool uses your local git credentials to push. Make sure you can push to the repo:

```bash
cd /path/to/ben-parry.github.io
git push  # This should work without prompting for password
```

If it doesn't work, set up SSH keys or a credential helper:
- SSH: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- HTTPS: https://docs.github.com/en/get-started/getting-started-with-git/caching-your-github-credentials-in-git

### 4. Install the Bookmarklet

Create a new bookmark in your browser with this code as the URL:

```javascript
javascript:(function(){const e=document.querySelector('[data-testid="note"]')||document.querySelector('article');if(!e)return alert('No note found');const t=e.innerText,n=t.split('\n')[0],o=t.split('\n').slice(1).join('\n').trim(),i=[...e.querySelectorAll('img')].map(e=>e.src).filter(e=>!e.includes('profile')&&!e.includes('avatar'));fetch('http://localhost:3847/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:n,content:o,images:i})}).then(e=>e.json()).then(e=>{e.success?alert('Published! '+e.essayUrl):alert('Error: '+e.error)}).catch(e=>alert('Error: '+e.message))})();
```

**To create the bookmark:**
1. Right-click your bookmarks bar → "Add page" or "Add bookmark"
2. Name it "Publish Essay"
3. Paste the code above as the URL

## Usage

1. Start the server:
   ```bash
   cd tools
   node server.js
   ```

2. Write and post a Note on Substack
   - First line = essay title
   - Rest = essay body
   - Optionally attach up to 4 images

3. While viewing your published Note, click the "Publish Essay" bookmark

4. Done! The tool will:
   - Post to X (as a long-form post with images)
   - Create `essays/your-essay-title.html`
   - Update `essays.html` index
   - Push to GitHub (auto-deploys to benparry.ca)

## Troubleshooting

**"No note found" error**
- Make sure you're on the Substack Note page (not the main feed)
- The note should be fully loaded

**X posting fails**
- Check your API credentials in config.json
- Ensure your app has Read and Write permissions
- Check if you've hit rate limits

**Git push fails**
- Make sure you can `git push` manually from the repo
- Check your git credentials/SSH setup

**Images not uploading**
- X has a 5MB limit per image
- Only JPEG, PNG, GIF, and WEBP are supported
