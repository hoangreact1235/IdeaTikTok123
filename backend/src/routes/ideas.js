const express = require('express');
const router = express.Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TIKTOK_SEARCH_URL = process.env.TIKTOK_SEARCH_URL;
const DOUYIN_SEARCH_URL = process.env.DOUYIN_SEARCH_URL;

const exampleIdeas = [
  // Đau / vận động
  { id: 1,  source: 'TikTok',           topic: 'đau lưng mẹ bầu',         title: '5 cách giảm đau lưng khi mang thai tại nhà',                tags: ['#đaulưng', '#mẹbầu'] },
  { id: 2,  source: 'YouTube Shorts',   topic: 'chuột rút thai kỳ',        title: 'Chuột rút khi bầu — nguyên nhân và cách xử lý nhanh',        tags: ['#chuotrut', '#mẹbầu'] },
  { id: 3,  source: 'Instagram Reels',  topic: 'tập yoga mẹ bầu',          title: 'Yoga nhẹ cho mẹ bầu 3 tháng cuối an toàn tại nhà',           tags: ['#yoga', '#mẹbầu'] },
  { id: 4,  source: 'TikTok',           topic: 'phù chân mẹ bầu',          title: 'Tại sao chân bầu bị phù và cách giảm phù nhanh nhất',        tags: ['#phùchân', '#mẹbầu'] },
  { id: 5,  source: 'TikTok',           topic: 'cổ vai gáy mẹ bầu',        title: 'Mẹ bầu đau cổ vai gáy — 3 bài tập thả lỏng 5 phút',         tags: ['#cổvaigáy', '#mẹbầu'] },
  // Dinh dưỡng
  { id: 6,  source: 'YouTube Shorts',   topic: 'dinh dưỡng mẹ bầu',        title: 'Thực đơn dinh dưỡng cho mẹ bầu 3 tháng đầu đầy đủ',         tags: ['#dinhdưỡng', '#mẹbầu'] },
  { id: 7,  source: 'TikTok',           topic: 'thực phẩm tốt cho bầu',    title: '10 thực phẩm mẹ bầu nên ăn mỗi tuần',                       tags: ['#thựcphẩm', '#mẹbầu'] },
  { id: 8,  source: 'Instagram Reels',  topic: 'canxi cho mẹ bầu',         title: 'Nguồn canxi tự nhiên tốt nhất cho mẹ bầu không cần thuốc',   tags: ['#canxi', '#mẹbầu'] },
  { id: 9,  source: 'TikTok',           topic: 'ốm nghén',                 title: 'Ốm nghén nặng — mẹo giảm buồn nôn được bác sĩ khuyên',       tags: ['#ốmnghén', '#mẹbầu'] },
  { id: 10, source: 'YouTube Shorts',   topic: 'canh lợi sữa',             title: '5 loại canh giúp lợi sữa hiệu quả cho mẹ sau sinh',          tags: ['#sữamẹ', '#saussinh'] },
  // Chăm sóc da / ngoại hình
  { id: 11, source: 'TikTok',           topic: 'rạn da mẹ bầu',            title: 'Ngăn rạn da khi bầu từ tháng thứ 4 — đúng cách đúng thời điểm', tags: ['#rạnda', '#mẹbầu'] },
  { id: 12, source: 'Instagram Reels',  topic: 'chăm sóc da mẹ bầu',       title: 'Skincare an toàn cho mẹ bầu — thành phần nào được và không được', tags: ['#skincare', '#mẹbầu'] },
  { id: 13, source: 'TikTok',           topic: 'thời trang mẹ bầu',        title: '8 kiểu mặc đẹp khi bụng to mà vẫn thanh lịch',              tags: ['#thờitrang', '#mẹbầu'] },
  // Tâm lý / giấc ngủ
  { id: 14, source: 'TikTok',           topic: 'mất ngủ thai kỳ',          title: 'Mẹ bầu mất ngủ — nguyên nhân và 4 cách ngủ sâu hơn',        tags: ['#mấtngủ', '#mẹbầu'] },
  { id: 15, source: 'YouTube Shorts',   topic: 'lo âu khi mang thai',      title: 'Tâm lý bất ổn khi mang thai — mẹ không đơn độc',            tags: ['#tâmlý', '#mẹbầu'] },
  { id: 16, source: 'Instagram Reels',  topic: 'thiền cho mẹ bầu',         title: 'Thiền 10 phút mỗi sáng giúp mẹ bầu giảm stress hiệu quả',   tags: ['#thiền', '#mẹbầu'] },
  // Sau sinh
  { id: 17, source: 'TikTok',           topic: 'phục hồi sau sinh',        title: 'Lịch phục hồi sau sinh mổ — tuần 1 đến tuần 8',             tags: ['#saussinh', '#phụchồi'] },
  { id: 18, source: 'YouTube Shorts',   topic: 'sữa mẹ sau sinh',          title: 'Làm sao để có nhiều sữa ngay những ngày đầu sau sinh',       tags: ['#sữamẹ', '#saussinh'] },
  { id: 19, source: 'TikTok',           topic: 'bụng sau sinh',            title: 'Bụng sau sinh — khi nào tập và tập gì là đúng',             tags: ['#bụngsaussinh', '#saussinh'] },
  { id: 20, source: 'Instagram Reels',  topic: 'trầm cảm sau sinh',        title: 'Dấu hiệu trầm cảm sau sinh mẹ cần nhận ra sớm',            tags: ['#trầmcảm', '#saussinh'] },
  // Thai nhi
  { id: 21, source: 'TikTok',           topic: 'thai nhi vận động',        title: 'Thai đạp ít hay nhiều là bình thường? Bác sĩ giải đáp',     tags: ['#thainhi', '#mẹbầu'] },
  { id: 22, source: 'YouTube Shorts',   topic: 'siêu âm thai',             title: 'Các mốc siêu âm quan trọng mẹ bầu không được bỏ qua',       tags: ['#siêuâm', '#mẹbầu'] },
  { id: 23, source: 'TikTok',           topic: 'chuẩn bị sinh',            title: 'Checklist đồ đi sinh cho mẹ và bé đầy đủ nhất 2025',        tags: ['#đissinh', '#mẹbầu'] },
  // Cho bú
  { id: 24, source: 'TikTok',           topic: 'cho bú đúng cách',         title: 'Khớp ngậm đúng khi cho bú — lỗi mẹ thường gặp nhất',       tags: ['#chobú', '#sữamẹ'] },
  { id: 25, source: 'Instagram Reels',  topic: 'tắc tia sữa',              title: 'Tắc tia sữa — xử lý tại nhà đúng cách không lo viêm vú',    tags: ['#tắctiasữa', '#sữamẹ'] },
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
    if (!YOUTUBE_API_KEY && platform !== 'all') {
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
    const normalizedTag = query.replace(/\s+/g, '').replace(/[^a-z0-9àáạảãăắặẳẵâấậẩẫèéẹẻẽêếệểễìíịỉĩòóọỏõôốộổỗơớợởỡùúụủũưứựửữỳýỵỷỹđ]/gi, '');
    const fallbackIdeas = [
      { id: 1001, source: 'TikTok',          topic: `${queryRaw} cho mẹ bầu`,   title: `${queryRaw} — những điều mẹ bầu cần biết`,                   tags: [`#${normalizedTag}`, '#mẹbầu'] },
      { id: 1002, source: 'YouTube Shorts',  topic: `${queryRaw} sau sinh`,     title: `${queryRaw} sau sinh — hướng dẫn đúng cách`,                 tags: [`#${normalizedTag}`, '#sausinh'] },
      { id: 1003, source: 'Instagram Reels', topic: `bí quyết ${queryRaw}`,     title: `Bí quyết xử lý ${queryRaw} hiệu quả cho mẹ bầu và sau sinh`, tags: [`#${normalizedTag}`, '#mẹbầu'] }
    ];
    ideas = fallbackIdeas.filter((idea) => matchesPlatform(idea));
  }

  res.json({ query: queryRaw, platform: platformRaw, ideas, errors });
});

module.exports = router;
