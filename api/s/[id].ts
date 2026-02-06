import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Story {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  bullets: string[];
  location: { name: string };
}

interface Edition {
  date: string;
  stories: Story[];
}

const APP_URL = process.env.APP_URL || 'https://avactu.com';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const storyId = Array.isArray(id) ? id[0] : id;

  if (!storyId) {
    return res.redirect(302, '/');
  }

  try {
    // Fetch stories from CDN
    const storiesRes = await fetch(`${APP_URL}/data/stories.json`);
    if (!storiesRes.ok) {
      return res.redirect(302, '/');
    }

    const edition: Edition = await storiesRes.json();
    const story = edition.stories.find((s) => s.id === storyId);

    if (!story) {
      return res.redirect(302, '/');
    }

    const title = escapeHtml(story.title);
    const description = escapeHtml(story.bullets[0] || '');
    const image = escapeHtml(story.imageUrl);
    const url = `${APP_URL}/s/${encodeURIComponent(storyId)}`;
    const redirectUrl = `${APP_URL}/#${encodeURIComponent(storyId)}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Avactu</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:site_name" content="Avactu" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0; url=${redirectUrl}" />
</head>
<body>
  <script>window.location.replace("${redirectUrl}");</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch {
    return res.redirect(302, '/');
  }
}
