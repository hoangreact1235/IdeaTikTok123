const express = require('express');
const router = express.Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TIKTOK_SEARCH_URL = process.env.TIKTOK_SEARCH_URL;
const DOUYIN_SEARCH_URL = process.env.DOUYIN_SEARCH_URL;

const exampleIdeas = [
  { id: 1, source: 'TikTok', topic: 'massage bau', title: '5 dong tac massage bau cho me thoai mai', tags: ['#massagebau', '#mebau'] },
  { id: 2, source: 'Douyin', topic: 'cham soc sau sinh', title: 'Chu trinh duong da sau sinh an toan', tags: ['#sausinh', '#skincare'] },
  { id: 3, source: 'TikTok', topic: 'me va be', title: 'Tap yoga nhe cho me bau tai nha', tags: ['#yogamebau', '#mevabe'] },
  { id: 4, source: 'YouTube Shorts', topic: 'tu van dinh duong', title: 'Thuc don dinh duong cho me bau 3 thang dau', tags: ['#dinhduong', '#mebau'] },
  { id: 5, source: 'Instagram Reels', topic: 'trang phuc me bau', title: '10 kieu thoi trang bau mua he de mac', tags: ['#dobau', '#stylemebau'] },
  { id: 6, source: 'TikTok', topic: 'giam dau lung', title: 'Bai tap giam dau lung cho me bau tai nha', tags: ['#giamdau', '#yogamebau'] },
  { id: 7, source: 'Douyin', topic: 'tam ly thai ky', title: 'Cach giu tinh than thoai mai trong thai ky', tags: ['#tamly', '#thaiky'] },
  { id: 8, source: 'YouTube Shorts', topic: 'cham soc da', title: 'Cham soc da me bau tranh nam hieu qua', tags: ['#chamsocda', '#mebau'] },
  { id: 9, source: 'Instagram Reels', topic: 'sinh hoat sau sinh', title: 'Lich sinh hoat khoa hoc cho me sau sinh', tags: ['#sausinh', '#mevabe'] }
];

async function searchExternalService(url, query, source) {
  if (!url) {
    return { ideas: [], error: null };
  }

  try {
    const serviceUrl = new URL(url);
    serviceUrl.searchParams.set('query', query);
    const response = await fetch(serviceUrl.toString());
    if (!response.ok) {
      const text = await response.text();
      const message = `External ${source} search failed: ${response.status} ${text}`;
      console.warn(message);
      return { ideas: [], error: message };
    }
    const data = await response.json();
    return {
      ideas: (data.ideas || []).map((idea, index) => ({
        id: `${source.toLowerCase().slice(0, 3)}-${index}`,
        source,
        topic: idea.topic || idea.title || query,
        title: idea.title || idea.topic || query,
        tags: idea.tags || [`#${query.replace(/\s+/g, '')}`, '#mebau']
      })),
      error: null
    };
  } catch (error) {
    const message = `External ${source} search failed: ${error.message}`;
    console.warn(message);
    return { ideas: [], error: message };
  }
}

async function searchYouTube(query, maxResults = 6) {
  if (!YOUTUBE_API_KEY) {
    return { ideas: [], error: null };
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', YOUTUBE_API_KEY);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('q', query);
  url.searchParams.set('videoDuration', 'short');

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    const message = `YouTube search failed: ${response.status} ${text}`;
    console.warn(message);
    return { ideas: [], error: message };
  }

  const data = await response.json();
  return {
    ideas: (data.items || []).map((item, index) => ({
      id: `yt-${item.id.videoId || index}`,
      source: 'YouTube Shorts',
      topic: item.snippet.title,
      title: item.snippet.title,
      tags: ['#mebau', '#YouTubeShorts', `#${item.snippet.channelTitle.replace(/\s+/g, '')}`]
    })),
    error: null
  };
}

router.get('/search', async (req, res) => {
  const queryRaw = req.query.query || '';
  const query = queryRaw.toString().trim().toLowerCase();
  const platformRaw = req.query.platform || 'all';
  const platform = platformRaw.toString().trim().toLowerCase();
  const errors = [];

  const matchesPlatform = (idea) => {
    if (!platform || platform === 'all') return true;
    return idea.source.toLowerCase().includes(platform);
  };

  const matchesQuery = (idea) => {
    if (!query) return true;
    const searchable = [idea.title, idea.topic, idea.source, ...(idea.tags || [])]
      .join(' ')
      .toLowerCase();
    return searchable.includes(query);
  };

  let ideas = exampleIdeas.filter((idea) => matchesPlatform(idea) && matchesQuery(idea));

  if (query && (platform === 'all' || platform.includes('youtube'))) {
    const { ideas: youtubeResults, error: youtubeError } = await searchYouTube(queryRaw);
    if (!YOUTUBE_API_KEY) {
      errors.push('YOUTUBE_API_KEY chua duoc cau hinh.');
    }
    if (youtubeError) {
      errors.push(youtubeError);
    }
    if (platform === 'all') {
      ideas = [...youtubeResults, ...ideas];
    } else {
      ideas = youtubeResults;
    }
  }

  if (query && (platform === 'all' || platform.includes('tiktok'))) {
    const { ideas: tiktokResults, error: tiktokError } = await searchExternalService(TIKTOK_SEARCH_URL, queryRaw, 'TikTok');
    if (tiktokError) {
      errors.push(tiktokError);
    }
    if (platform === 'tiktok') {
      ideas = tiktokResults;
    } else if (platform === 'all') {
      ideas = [...tiktokResults, ...ideas];
    }
  }

  if (query && (platform === 'all' || platform.includes('douyin'))) {
    const { ideas: douyinResults, error: douyinError } = await searchExternalService(DOUYIN_SEARCH_URL, queryRaw, 'Douyin');
    if (douyinError) {
      errors.push(douyinError);
    }
    if (platform === 'douyin') {
      ideas = douyinResults;
    } else if (platform === 'all') {
      ideas = [...douyinResults, ...ideas];
    }
  }

  if (!ideas.length && query) {
    const normalizedTag = query.replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
    const fallbackIdeas = [
      { id: 1001, source: 'TikTok', topic: `${query} cho me bau`, title: `${query} me bau: y tuong video hot`, tags: [`#${normalizedTag}`, '#mebau', '#TikTok'] },
      { id: 1002, source: 'YouTube Shorts', topic: `giai phap ${query}`, title: `Cach ${query} cho me bau va sau sinh`, tags: [`#${normalizedTag}`, '#shorts', '#mebau'] },
      { id: 1003, source: 'Instagram Reels', topic: `bi quyet ${query}`, title: `Bi quyet ${query} cho me bau`, tags: [`#${normalizedTag}`, '#reels', '#mebau'] }
    ];
    ideas = fallbackIdeas.filter((idea) => matchesPlatform(idea));
  }

  res.json({ query: queryRaw, platform: platformRaw, ideas, errors });
});

module.exports = router;
