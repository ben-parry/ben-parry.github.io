#!/usr/bin/env python3
"""Fetch Substack RSS feed and generate static JSON files for the blog."""

import json
import os
import re
import urllib.request
from html import unescape
from xml.etree import ElementTree

FEED_URL = "https://benparry.substack.com/feed"
POSTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "posts")

NAMESPACES = {
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def fetch_feed():
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": "substack-update/1.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def slug_from_link(link):
    """Extract the slug from a Substack post URL."""
    match = re.search(r"/p/([^/?#]+)", link)
    return match.group(1) if match else None


def parse_items(xml_bytes):
    root = ElementTree.fromstring(xml_bytes)
    items = root.findall(".//item")
    posts = []

    for item in items:
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        pub_date = item.findtext("pubDate", "").strip()
        slug = slug_from_link(link)
        if not slug:
            continue

        # Prefer content:encoded, fall back to description
        content_el = item.find("content:encoded", NAMESPACES)
        if content_el is not None and content_el.text:
            content = content_el.text
        else:
            content = item.findtext("description", "")

        posts.append({
            "title": title,
            "slug": slug,
            "date": pub_date,
            "content": content,
        })

    return posts


def write_posts(posts):
    os.makedirs(POSTS_DIR, exist_ok=True)

    new_count = 0
    existing_count = 0

    for post in posts:
        path = os.path.join(POSTS_DIR, f"{post['slug']}.json")
        if os.path.exists(path):
            existing_count += 1
            continue

        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "title": post["title"],
                "date": post["date"],
                "content": post["content"],
            }, f, ensure_ascii=False, indent=2)
        new_count += 1

    # Write index (always regenerated so ordering stays current)
    index = [{"title": p["title"], "slug": p["slug"], "date": p["date"]} for p in posts]
    with open(os.path.join(POSTS_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    return new_count, existing_count


def main():
    print("Fetching RSS feed...")
    xml_bytes = fetch_feed()

    posts = parse_items(xml_bytes)
    print(f"Found {len(posts)} posts in feed.")

    new_count, existing_count = write_posts(posts)
    print(f"New: {new_count}, Already existed: {existing_count}")
    print(f"Index written to {os.path.join(POSTS_DIR, 'index.json')}")


if __name__ == "__main__":
    main()
