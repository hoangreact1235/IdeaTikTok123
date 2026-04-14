const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function clampDuration(duration) {
  const parsed = Number(duration);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(180, Math.max(45, Math.round(parsed)));
}

function estimateWordTarget(duration) {
  const target = Math.round(duration * 2.0);
  return { min: Math.max(100, target - 20), max: target + 20 };
}

function estimateMaxTokens(duration) {
  if (duration <= 60) return 1200;
  if (duration <= 90) return 1500;
  if (duration <= 120) return 1800;
  return 2000;
}

function safeArray(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function parseJsonFromText(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    const codeFenceMatch = text.match(/```json\s*([\s\S]*?)```/i);
    if (codeFenceMatch?.[1]) {
      try {
        return JSON.parse(codeFenceMatch[1]);
      } catch (innerError) {
        // continue parsing
      }
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (innerError) {
        // give up
      }
    }
  }

  return null;
}

function normalizeProvider(input) {
  const raw = String(input || 'auto').trim().toLowerCase();
  if (raw === 'openai' || raw === 'gemini' || raw === 'auto' || raw === 'fallback') return raw;
  return 'auto';
}

function toneProfile(toneText) {
  const tone = String(toneText || '').toLowerCase();

  if (tone.includes('chuyên gia') || tone.includes('chuyen gia')) {
    return {
      name: 'chuyên gia',
      stylisticRule: 'Giọng chắc chắn, có framework rõ, câu ngắn và có số liệu/tiêu chí kiểm tra.',
      structureHint: 'Mở vấn đề -> nguyên nhân -> quy trình 3 bước -> lỗi thường gặp -> chốt hành động.',
      ctaHint: 'CTA thiên về tải checklist hoặc comment để nhận template.'
    };
  }

  if (tone.includes('truyền cảm hứng') || tone.includes('truyen cam hung')) {
    return {
      name: 'truyền cảm hứng',
      stylisticRule: 'Giọng giàu cảm xúc, có nhịp lên xuống, có một hình ảnh hoặc ví dụ đời thường.',
      structureHint: 'Mở bằng câu chạm cảm xúc -> câu chuyện ngắn -> 3 hành động cụ thể -> CTA tích cực.',
      ctaHint: 'CTA khích lệ chia sẻ trải nghiệm cá nhân.'
    };
  }

  if (tone.includes('thực tế') || tone.includes('di thang')) {
    return {
      name: 'thực tế, đi thẳng vấn đề',
      stylisticRule: 'Giọng thẳng, ít mỹ từ, ưu tiên checklist và mệnh lệnh hành động.',
      structureHint: 'Hook trực diện -> checklist 3 bước -> cảnh báo sai lầm -> CTA ngắn.',
      ctaHint: 'CTA yêu cầu người xem chọn 1 bước làm ngay hôm nay.'
    };
  }

  return {
    name: 'thân thiện',
    stylisticRule: 'Giọng gần gũi, dễ hiểu, như đang tư vấn 1-1.',
    structureHint: 'Hook đồng cảm -> giải thích ngắn -> 3 bước dễ làm -> CTA nhẹ nhàng.',
    ctaHint: 'CTA mời lưu video và follow để xem phần tiếp theo.'
  };
}

function buildPrompt({ titleText, topicText, duration, toneText }) {
  const { min, max } = estimateWordTarget(duration);
  const style = toneProfile(toneText);
  
  const detailGuidance = duration > 90 
    ? '\n- LƯỚI CHỈ CHI TIẾT (video dài): Mở rộng từng bước với VÍ DỤ CỤ THỂ, CON SỐ hoặc TÌNH HUỐNG THỰC TẾ. Mỗi bước cần có ít nhất 1-2 ví dụ hoặc lưu ý bổ sung. Không chỉ nói "làm cách A", mà "làm cách A vì lý do X, ví dụ Y, cảnh báo Z".'
    : '';

  return [
    'Bạn là một nhà sáng tạo nội dung chuyên nghiệp cho TikTok/Reels, không viết kiểu máy móc.',
    `Hãy viết kịch bản voice-off tiếng Việt cho video ${duration} giây về chủ đề: ${topicText}.`,
    `Tiêu đề ý tưởng: ${titleText}`,
    `Tone bắt buộc: ${style.name}`,
    '',
    'YÊU CẦU CỐT LÕI (bắt buộc tuân thủ):',
    `- Độ dài voiceOff khoảng ${min}-${max} từ.`,
    `- Phong cách: ${style.stylisticRule}`,
    `- Khung triển khai: ${style.structureHint}`,
    `- ${style.ctaHint}`,
    '- Có ít nhất 3 hành động cụ thể, người xem có thể làm ngay.',
    '- Không dùng các câu rỗng như "hãy cố gắng", "hãy kiên trì" nếu không kèm hành động cụ thể.',
    '- Không lặp cụm từ/ý giống nhau nhiều lần trong cùng đoạn.',
    '- Nội dung bám trọng tâm chủ đề, không lan man.',
    '- Có 1 câu lưu ý an toàn phù hợp cho mẹ bầu/sau sinh (không chẩn đoán y khoa).',
    detailGuidance,
    '',
    'TRẢ VỀ DUY NHẤT JSON hợp lệ theo schema sau:',
    '{',
    '  "title": "string",',
    '  "caption": "string",',
    '  "hashtags": ["#tag1", "#tag2", "#tag3"],',
    '  "voiceOff": "string",',
    '  "script": "string"',
    '}'
  ].join('\n');
}

async function generateWithOpenAI(prompt, maxTokens = 1200) {
  if (!OPENAI_API_KEY) {
    return { ok: false, reason: 'OPENAI_API_KEY is missing' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Bạn là nhà sáng tạo nội dung chuyên nghiệp, ưu tiên chiều sâu và tính ứng dụng.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, reason: `OpenAI failed: ${response.status} ${errorText}` };
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, reason: 'OpenAI returned empty content' };
  }

  return { ok: true, text };
}

async function generateWithGemini(prompt, maxTokens = 1200) {
  if (!GEMINI_API_KEY) {
    return { ok: false, reason: 'GEMINI_API_KEY is missing' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        topP: 0.9,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, reason: `Gemini failed: ${response.status} ${errorText}` };
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, reason: 'Gemini returned empty content' };
  }

  return { ok: true, text };
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copied = [...items];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]];
  }
  return copied;
}

function detectIntent(topicText) {
  const text = String(topicText || '').toLowerCase().trim();
  if (/\b\d+\s*(món|mon|cách|cach|thực phẩm|thuc pham|điều|dieu|dấu hiệu|dau hieu|bí quyết|bi quyet|bài tập|bai tap|động tác|dong tac)\b/i.test(text)) return 'list';
  if (containsAny(text, ['top 5', 'top 7', 'top 10', 'danh sách', 'list'])) return 'list';
  if (/^(vì sao|tai sao|tại sao)/.test(text) || text.includes('vì sao') || text.includes('tại sao')) return 'why';
  if (text.includes('dấu hiệu') || text.includes('khi nào cần đi khám') || text.includes('có nguy hiểm không')) return 'warning';
  if (containsAny(text, ['nên ăn gì', 'ăn gì', 'nên dùng gì', 'sản phẩm nào', 'nên chọn', 'loại nào tốt'])) return 'recommend';
  if (text.includes('cách') || text.includes('làm sao') || text.includes('như thế nào') || text.includes('hướng dẫn')) return 'how';
  return 'general';
}

function extractRequestedCount(topicText, defaultCount = 5) {
  const text = String(topicText || '').toLowerCase();
  const match = text.match(/\b(\d{1,2})\b/);
  if (!match) return defaultCount;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return defaultCount;
  return Math.min(12, Math.max(3, parsed));
}

function getListMode(topicText) {
  const rawText = String(topicText || '').toLowerCase();
  if (containsAny(rawText, ['dấu hiệu', 'cảnh báo', 'đi khám', 'nguy hiểm'])) return 'warnings';
  if (containsAny(rawText, ['bài tập', 'động tác', 'vận động', 'tập gì'])) return 'exercises';
  if (containsAny(rawText, ['thực phẩm', 'món ăn', 'ăn gì', 'nên ăn', 'nên tránh', 'kiêng gì', 'canh'])) return 'foods';
  return 'general';
}

function buildListItems(topicText, knowledge, count) {
  const rawText = String(topicText || '').toLowerCase();
  const mode = getListMode(topicText);

  if (mode === 'warnings') {
    const warningItems = [
      { name: 'Ra huyết âm đạo', why: 'Dù nhiều hay ít cũng cần đi khám sớm để loại trừ nguy cơ cho mẹ và bé.' },
      { name: 'Đau bụng từng cơn tăng dần', why: 'Có thể liên quan cơn co hoặc vấn đề cần theo dõi ngay.' },
      { name: 'Đau đầu nhiều kèm mờ mắt', why: 'Là nhóm dấu hiệu không nên theo dõi tại nhà quá lâu.' },
      { name: 'Phù mặt tay chân đột ngột', why: 'Nếu đi kèm nhức đầu hoặc tăng huyết áp cần khám sớm.' },
      { name: 'Thai máy giảm rõ rệt', why: 'Mẹ nên được kiểm tra càng sớm càng tốt.' },
      { name: 'Sốt hoặc ớn lạnh kéo dài', why: 'Có thể là nhiễm trùng, cần đánh giá y tế thay vì tự xử lý.' },
      { name: 'Đau ngực, khó thở, choáng', why: 'Đây là nhóm dấu hiệu cấp, cần đến cơ sở y tế ngay.' },
      { name: 'Đau một chân kèm sưng nóng đỏ', why: 'Cần khám sớm để loại trừ nguyên nhân tuần hoàn nguy hiểm.' },
      { name: 'Ói nhiều không ăn uống được', why: 'Dễ mất nước và kiệt sức nếu kéo dài.' },
      { name: 'Vỡ ối hoặc rỉ ối bất thường', why: 'Nên vào viện để được đánh giá kịp thời.' }
    ];
    return {
      heading: 'Danh sách dấu hiệu cảnh báo:',
      items: warningItems.slice(0, count)
    };
  }

  if (mode === 'exercises') {
    const exerciseItems = [
      { name: 'Đi bộ chậm 10-20 phút', why: 'Giúp tuần hoàn tốt hơn và duy trì vận động an toàn hằng ngày.' },
      { name: 'Nghiêng chậu (pelvic tilt)', why: 'Hỗ trợ giảm mỏi lưng dưới khi bụng lớn dần.' },
      { name: 'Mèo-bò nhẹ nhàng', why: 'Thả lỏng cột sống và vùng lưng khi bị căng.' },
      { name: 'Giãn bắp chân sát tường', why: 'Giảm căng bắp chân và hỗ trợ hạn chế chuột rút.' },
      { name: 'Mở hông với tư thế bướm', why: 'Giúp hông linh hoạt hơn và giảm căng vùng chậu.' },
      { name: 'Thở bụng chậm 3-5 phút', why: 'Giúp thư giãn và giảm gồng cơ không cần thiết.' },
      { name: 'Kegel nhẹ theo nhịp', why: 'Hỗ trợ sàn chậu nếu thực hiện đúng kỹ thuật.' },
      { name: 'Xoay vai-thả cổ', why: 'Giảm mỏi vai gáy khi ngồi hoặc bế bé nhiều.' },
      { name: 'Nằm nghiêng kê gối đúng điểm', why: 'Giảm kéo căng lưng-hông và giúp ngủ dễ hơn.' },
      { name: 'Vươn tay kết hợp thở', why: 'Mở lồng ngực, cải thiện cảm giác nặng nề vùng vai.' }
    ];
    return {
      heading: 'Danh sách bài tập nên ưu tiên:',
      items: exerciseItems.slice(0, count)
    };
  }

  if (containsAny(rawText, ['lợi sữa', 'loi sua', 'gọi sữa', 'goi sua']) && containsAny(rawText, ['canh', 'món canh', 'mon canh'])) {
    const soups = [
      { name: 'Canh đu đủ xanh nấu móng giò', why: 'Đạm và nước từ món canh ấm giúp mẹ dễ ăn, dễ hồi phục sau sinh.' },
      { name: 'Canh rau ngót nấu thịt nạc', why: 'Rau ngót giàu vi chất, món nhẹ bụng và hợp cho bữa sau sinh.' },
      { name: 'Canh mồng tơi nấu tôm', why: 'Dễ tiêu, nhiều nước và giúp bữa ăn bớt khô, mẹ ăn dễ hơn.' },
      { name: 'Canh bí đỏ nấu xương hoặc thịt bằm', why: 'Bổ sung năng lượng vừa phải, vị ngọt dễ ăn khi mẹ mệt.' },
      { name: 'Canh hạt sen nấu gà', why: 'Món ấm, giàu đạm, hỗ trợ mẹ có bữa ăn đủ chất hơn.' },
      { name: 'Canh cà rốt khoai tây nấu thịt', why: 'Kết hợp tinh bột chậm và đạm giúp mẹ no bền hơn.' },
      { name: 'Canh rong biển nấu thịt bằm', why: 'Đổi vị, dễ ăn và tăng lượng nước trong khẩu phần.' },
      { name: 'Canh củ dền nấu sườn non', why: 'Thêm đa dạng rau củ, giúp bữa ăn sau sinh bớt đơn điệu.' },
      { name: 'Canh cải bó xôi nấu trứng', why: 'Nhanh gọn, phù hợp ngày mẹ thiếu thời gian chuẩn bị.' },
      { name: 'Canh bầu nấu tôm', why: 'Món thanh, dễ tiêu và phù hợp bữa tối nhẹ.' }
    ];
    return {
      heading: 'Danh sách món canh lợi sữa:',
      items: shuffle(soups).slice(0, count)
    };
  }

  if (mode === 'foods') {
    const shouldAvoid = containsAny(rawText, ['nên tránh', 'kiêng', 'không nên ăn', 'tránh ăn']);
    const foodGood = [
      { name: 'Cá, thịt nạc, trứng', why: 'Bổ sung đạm chất lượng giúp mẹ no bền và hỗ trợ phục hồi.' },
      { name: 'Rau lá xanh đậm', why: 'Tăng chất xơ và vi chất, hỗ trợ tiêu hóa tốt hơn.' },
      { name: 'Ngũ cốc nguyên cám', why: 'Giúp năng lượng ổn định hơn so với tinh bột nhanh.' },
      { name: 'Sữa chua không đường', why: 'Dễ dùng trong bữa phụ và thân thiện với tiêu hóa.' },
      { name: 'Đậu hũ, đậu đỗ', why: 'Nguồn đạm thực vật dễ phối bữa.' },
      { name: 'Trái cây ít ngọt', why: 'Giảm tăng đường huyết nhanh sau ăn.' },
      { name: 'Các món canh rau củ', why: 'Tăng lượng nước và giúp bữa ăn dễ tiêu hơn.' },
      { name: 'Hạt không tẩm đường', why: 'Làm bữa phụ gọn mà vẫn đủ chất béo tốt.' },
      { name: 'Khoai lang, yến mạch', why: 'Tinh bột chậm, no lâu hơn.' },
      { name: 'Nước ấm xen kẽ trong ngày', why: 'Giúp duy trì cân bằng dịch và tiêu hóa thuận hơn.' }
    ];
    const foodAvoid = [
      { name: 'Nước ngọt, trà sữa nhiều đường', why: 'Dễ làm đường huyết tăng nhanh và khó kiểm soát cân nặng.' },
      { name: 'Bánh kẹo ngọt ăn vặt liên tục', why: 'Năng lượng rỗng, ít giá trị dinh dưỡng.' },
      { name: 'Đồ chiên nhiều dầu', why: 'Dễ gây đầy bụng và làm bữa ăn mất cân đối.' },
      { name: 'Đồ quá mặn', why: 'Có thể làm mẹ khát nhiều và mệt hơn.' },
      { name: 'Đồ uống kích thích cao', why: 'Không phù hợp khi cần nhịp sinh hoạt ổn định cho mẹ.' },
      { name: 'Ăn quá khuya sát giờ ngủ', why: 'Dễ làm tiêu hóa nặng nề và ngủ kém hơn.' },
      { name: 'Bỏ bữa rồi ăn bù', why: 'Làm năng lượng dao động mạnh trong ngày.' },
      { name: 'Theo trend ăn kiêng cực đoan', why: 'Có nguy cơ thiếu hụt chất khi mang thai/sau sinh.' },
      { name: 'Món không rõ nguồn gốc', why: 'Khó kiểm soát an toàn thực phẩm.' },
      { name: 'Lạm dụng thực phẩm chức năng thay bữa', why: 'Không thay được dinh dưỡng từ bữa ăn thật.' }
    ];
    return {
      heading: shouldAvoid ? 'Danh sách thực phẩm nên hạn chế:' : 'Danh sách thực phẩm nên ưu tiên:',
      items: shuffle(shouldAvoid ? foodAvoid : foodGood).slice(0, count)
    };
  }

  const merged = [
    ...(knowledge.recommendations || []).map((text, index) => ({ name: `Gợi ý ${index + 1}`, why: text })),
    ...(knowledge.quickActions || []).map((text, index) => ({ name: `Việc nên làm ${index + 1}`, why: text }))
  ];

  if (merged.length >= count) {
    return {
      heading: 'Danh sách gợi ý:',
      items: shuffle(merged).slice(0, count)
    };
  }

  const fallbacks = [
    { name: 'Ưu tiên thứ dễ duy trì', why: `Bắt đầu từ việc đơn giản nhất liên quan đến ${knowledge.subject}.` },
    { name: 'Theo dõi phản ứng cơ thể', why: 'Quan sát trước và sau khi áp dụng để biết điều gì thực sự hợp.' },
    { name: 'Giữ nhịp ổn định', why: 'Làm đều mỗi ngày thường hiệu quả hơn thay đổi quá nhiều cùng lúc.' }
  ];
  return {
    heading: 'Danh sách gợi ý:',
    items: [...merged, ...fallbacks].slice(0, count)
  };
}

function normalizeSubject(topicText) {
  return String(topicText || '')
    .replace(/^(vì sao|tai sao|tại sao)\s+/i, '')
    .replace(/^(cách|làm sao|như thế nào|hướng dẫn)\s+/i, '')
    .trim();
}

function cleanCandidateText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^(ý tưởng|y tuong)\s*(video)?\s*[:\-]?\s*/i, '')
    .replace(/\b(video hot|viral|top trend)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferFocusTopic(titleText, topicText) {
  const candidates = [topicText, titleText]
    .map((item) => cleanCandidateText(item))
    .filter(Boolean);

  if (!candidates.length) return 'chăm sóc mẹ bầu và sau sinh';

  const scoreCandidate = (value) => {
    let score = 0;
    const lower = value.toLowerCase();
    if (/(vì sao|tại sao|làm sao|như thế nào|cách|dấu hiệu|nguyên nhân)/i.test(value)) score += 5;
    if (value.includes('?')) score += 3;
    if (lower.includes('cho mẹ bầu') || lower.includes('mẹ bầu') || lower.includes('sau sinh')) score += 2;
    if (lower.includes('ý tưởng') || lower.includes('y tuong')) score -= 3;
    if (value.length < 12) score -= 1;
    if (value.length > 120) score -= 2;
    return score;
  };

  const best = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  return best;
}

function containsAny(text, phrases) {
  const source = String(text || '').toLowerCase();
  return phrases.some((phrase) => source.includes(String(phrase).toLowerCase()));
}

function sentenceCase(text) {
  const value = String(text || '').trim();
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTopicKnowledge(topicText) {
  const rawText = String(topicText || '').toLowerCase();
  const subject = normalizeSubject(topicText) || 'vấn đề mẹ bầu đang gặp';

  if (containsAny(rawText, ['đau lưng', 'mỏi lưng', 'đau thắt lưng'])) {
    return {
      subject: 'mẹ bầu đau lưng',
      explanation: 'Đau lưng ở mẹ bầu thường không đến từ một nguyên nhân duy nhất, mà là do tư thế, nội tiết và áp lực lên cột sống thay đổi cùng lúc.',
      whyReasons: [
        'Khi bụng lớn dần, trọng tâm cơ thể đổ ra trước, lưng dưới phải ưỡn nhiều hơn để giữ thăng bằng nên rất dễ mỏi và đau.',
        'Hormone thai kỳ làm dây chằng mềm hơn để chuẩn bị cho sinh nở, nhưng điều đó cũng khiến khớp vùng chậu và lưng kém ổn định hơn bình thường.',
        'Nếu mẹ ngồi lâu, đứng lâu hoặc ngủ sai tư thế, nhóm cơ lưng và hông sẽ phải gồng liên tục, vì vậy cơn đau xuất hiện rõ hơn vào cuối ngày.'
      ],
      quickActions: [
        'Ưu tiên ngồi tựa lưng, kê gối nhỏ sau thắt lưng và đổi tư thế sau mỗi 30 đến 45 phút.',
        'Khi nằm ngủ, kẹp gối giữa hai đầu gối hoặc kê thêm gối dưới bụng để giảm kéo căng vùng thắt lưng.',
        'Tập nhẹ các động tác giãn hông, nghiêng chậu hoặc đi bộ chậm 5 đến 10 phút để cơ lưng không bị co cứng.'
      ],
      reassurance: 'Phần lớn đau lưng thai kỳ có thể dịu đi khi mẹ chỉnh lại tư thế, nhịp nghỉ và cách nâng đỡ cơ thể mỗi ngày.',
      warningSigns: 'Nếu đau lưng đi kèm ra huyết, đau bụng từng cơn, tê lan xuống chân mạnh hoặc khó đi lại, mẹ nên đi khám sớm để loại trừ nguy cơ khác.',
      ctas: [
        'Comment ĐAU LƯNG để mình làm riêng một video 3 tư thế ngủ giúp mẹ đỡ mỏi hơn.',
        'Nếu muốn mình viết tiếp phần cách giảm đau lưng an toàn tại nhà, để lại chữ LƯNG nhé.'
      ]
    };
  }

  if (containsAny(rawText, ['phù chân', 'sưng chân', 'phù nề chân', 'mắt cá sưng'])) {
    return {
      subject,
      explanation: 'Phù chân ở mẹ bầu thường tăng khi tuần thai lớn hơn, đứng ngồi lâu hoặc tuần hoàn trở về tim chậm hơn.',
      whyReasons: [
        'Lượng máu và dịch trong cơ thể tăng lên khi mang thai làm chân và mắt cá dễ giữ nước hơn.',
        'Tử cung lớn dần có thể gây áp lực lên mạch máu vùng chậu, khiến máu từ chân trở về chậm hơn.',
        'Đứng lâu, ngồi một chỗ lâu hoặc ăn quá mặn đều có thể làm cảm giác nặng chân rõ hơn.'
      ],
      quickActions: [
        'Gác chân cao ngắn 10 đến 15 phút vài lần trong ngày.',
        'Đi bộ chậm hoặc xoay cổ chân để bắp chân bơm máu tốt hơn.',
        'Uống đủ nước và giảm đồ quá mặn để cơ thể cân bằng dịch tốt hơn.'
      ],
      reassurance: 'Điều quan trọng là giúp tuần hoàn tốt hơn trong ngày, chứ không phải cố nhịn nước hay chịu nặng chân.',
      warningSigns: 'Nếu phù xuất hiện đột ngột, kèm đau đầu, mờ mắt hoặc tăng huyết áp, cần đi khám để được kiểm tra ngay.',
      ctas: [
        `Muốn mình làm tiếp checklist giảm phù chân tại nhà cho ${subject}, để lại chữ PHÙ nhé.`,
        `Comment CHÂN NHẸ nếu bạn muốn mình viết riêng routine 5 phút cho ${subject}.`
      ]
    };
  }

  if (containsAny(rawText, ['mất ngủ', 'khó ngủ', 'ngủ không sâu', 'thức giữa đêm'])) {
    return {
      subject,
      explanation: 'Mất ngủ ở mẹ bầu thường đến từ thay đổi hormone, bụng lớn dần và việc cơ thể khó tìm được tư thế nghỉ thoải mái.',
      whyReasons: [
        'Hormone thay đổi làm giấc ngủ nông hơn và mẹ dễ tỉnh giữa đêm.',
        'Khi bụng lớn dần, việc xoay trở khó hơn nên chỉ cần một điểm tì không thoải mái là mẹ đã thức giấc.',
        'Ăn muộn, uống nhiều nước sát giờ ngủ hoặc lo lắng kéo dài cũng làm cơ thể khó vào giấc hơn.'
      ],
      quickActions: [
        'Tạo một giờ đi ngủ cố định và giảm ánh sáng xanh trước khi ngủ 30 phút.',
        'Dùng gối ôm hoặc gối kê giữa hai chân để cơ thể dễ thả lỏng hơn.',
        'Nếu tỉnh giữa đêm, đừng cố ngủ ngay; thử thở chậm hoặc ngồi dậy thư giãn vài phút rồi nằm lại.'
      ],
      reassurance: 'Mẹ không cần ép mình ngủ ngay lập tức; chỉ cần tạo điều kiện để cơ thể dễ thả lỏng hơn từng đêm.',
      warningSigns: 'Nếu mất ngủ kéo dài khiến mẹ kiệt sức, tim đập nhanh hoặc lo âu nhiều, nên trao đổi với bác sĩ để được hướng dẫn phù hợp.',
      ctas: [
        `Nếu muốn mình viết luôn routine ngủ 15 phút cho ${subject}, comment NGỦ NGON nhé.`,
        `Để lại chữ GIẤC NGỦ nếu bạn muốn mình làm tiếp phần tư thế ngủ cho mẹ bầu.`
      ]
    };
  }

  if (containsAny(rawText, ['cổ vai gáy', 'vai gáy', 'mỏi cổ', 'đau vai'])) {
    return {
      subject: 'đau cổ vai gáy khi mang thai',
      explanation: 'Đau cổ vai gáy ở mẹ bầu thường xuất hiện khi vai phải gồng lâu, ngủ thiếu nâng đỡ hoặc cúi nhìn điện thoại quá nhiều.',
      whyReasons: [
        'Khi bụng lớn hơn, vai và lưng trên thường vô thức gồng để giữ tư thế nên vùng cổ gáy rất dễ căng cứng.',
        'Nằm gối quá cao hoặc quá thấp có thể làm cổ không được nâng đúng trục, sáng dậy sẽ đau rõ hơn.',
        'Nhìn điện thoại, ngồi làm việc hoặc cho con bú sai tư thế trong thời gian dài cũng khiến cơ vai gáy bị quá tải.'
      ],
      quickActions: [
        'Đặt màn hình hoặc điện thoại ngang tầm mắt để giảm cúi cổ kéo dài.',
        'Xoay vai nhẹ, thả lỏng cổ và ép bả vai về sau vài lần sau mỗi 30 đến 45 phút.',
        'Kê gối vừa đủ để cổ thẳng hàng với lưng khi nằm nghiêng.'
      ],
      reassurance: 'Chỉ cần bớt gồng vai và chỉnh tư thế đúng hơn, vùng cổ vai gáy thường sẽ nhẹ đi khá nhiều.',
      warningSigns: 'Nếu đau kèm tê tay rõ, yếu tay hoặc đau tăng liên tục, mẹ nên đi khám để kiểm tra thêm.',
      ctas: [
        'Muốn mình làm video 3 động tác thả cổ vai gáy cho mẹ bầu, comment VAI GÁY nhé.',
        'Nếu cần routine 5 phút giảm mỏi cổ vai gáy, để lại chữ CỔ VAI nha.'
      ]
    };
  }

  if (containsAny(rawText, ['chuột rút', 'vọp bẻ', 'co cứng bắp chân'])) {
    return {
      subject: 'chuột rút ở mẹ bầu',
      explanation: 'Chuột rút khi mang thai thường xuất hiện vào ban đêm hoặc sau khi đứng lâu, khi cơ bắp mệt và tuần hoàn chưa tốt.',
      whyReasons: [
        'Cơ chân phải làm việc nhiều hơn khi cân nặng tăng dần nên dễ mỏi và co thắt.',
        'Ngồi hoặc đứng một tư thế quá lâu có thể làm tuần hoàn ở chân kém hơn, khiến cơ dễ bị chuột rút.',
        'Nếu mẹ ít giãn cơ, uống ít nước hoặc cuối ngày quá mệt, cơn vọp bẻ thường xuất hiện rõ hơn.'
      ],
      quickActions: [
        'Trước khi ngủ, duỗi bắp chân nhẹ 1 đến 2 phút mỗi bên.',
        'Nếu đang bị chuột rút, kéo mũi chân hướng về phía người và xoa nhẹ bắp chân.',
        'Đi bộ chậm vài phút trong ngày và uống đủ nước để cơ bắp đỡ bị co cứng.'
      ],
      reassurance: 'Mục tiêu là giúp cơ chân bớt mệt và tuần hoàn tốt hơn, chứ không phải chờ đến lúc bị vọp bẻ rồi mới xử lý.',
      warningSigns: 'Nếu đau một bên chân kèm sưng nóng đỏ rõ hoặc khó đi lại, cần đi khám sớm để loại trừ nguyên nhân khác.',
      ctas: [
        'Comment CHÂN để mình làm tiếp video chống chuột rút ban đêm cho mẹ bầu.',
        'Muốn mình viết routine 3 phút trước ngủ để đỡ vọp bẻ, để lại chữ CHUỘT RÚT nhé.'
      ]
    };
  }

  if (containsAny(rawText, ['rạn da', 'da rạn', 'nứt da'])) {
    return {
      subject: 'rạn da khi mang thai',
      explanation: 'Rạn da không chỉ do bôi thiếu dưỡng, mà còn liên quan đến tốc độ da bị kéo giãn, cơ địa và thay đổi nội tiết.',
      whyReasons: [
        'Khi bụng và ngực tăng kích thước nhanh, sợi nâng đỡ của da không kịp thích nghi nên dễ xuất hiện vết rạn.',
        'Cơ địa từng có rạn da từ trước hoặc người thân từng bị nhiều thì nguy cơ cũng cao hơn.',
        'Da quá khô, tăng cân nhanh hoặc chăm da quá muộn thường làm cảm giác căng ngứa và vết rạn rõ hơn.'
      ],
      quickActions: [
        'Dưỡng ẩm đều vùng bụng, hông, đùi và ngực sau tắm khi da còn hơi ẩm.',
        'Tăng cân theo nhịp ổn định thay vì để cơ thể tăng quá nhanh trong thời gian ngắn.',
        'Nếu da ngứa nhiều, ưu tiên sản phẩm dịu nhẹ và mặc đồ mềm để giảm ma sát.'
      ],
      reassurance: 'Dưỡng da không đảm bảo hết rạn hoàn toàn, nhưng làm đều từ sớm sẽ giúp da đỡ khô căng và dễ chịu hơn.',
      warningSigns: 'Nếu da đỏ rát, ngứa dữ dội hoặc nổi mẩn lan rộng, mẹ nên đi khám để phân biệt với vấn đề da khác.',
      ctas: [
        'Nếu muốn mình làm routine chống khô ngứa và hỗ trợ giảm rạn, comment RẠN DA nhé.',
        'Để lại chữ DƯỠNG nếu bạn muốn checklist chăm da cho mẹ bầu.'
      ]
    };
  }

  if (containsAny(rawText, ['táo bón', 'khó đi ngoài', 'đi ngoài khó'])) {
    return {
      subject: 'táo bón ở mẹ bầu',
      explanation: 'Táo bón thai kỳ khá thường gặp vì hormone làm ruột vận động chậm hơn, cộng thêm việc ít uống nước hoặc ít vận động.',
      whyReasons: [
        'Hormone thai kỳ làm nhu động ruột chậm lại nên phân dễ khô và khó đi hơn.',
        'Nếu mẹ uống ít nước hoặc ăn ít chất xơ, ruột sẽ càng khó đẩy phân ra ngoài.',
        'Ngồi nhiều, ít đi lại hoặc nhịn đi vệ sinh cũng khiến táo bón kéo dài hơn.'
      ],
      quickActions: [
        'Bắt đầu ngày mới bằng nước ấm và giữ lượng nước đều trong cả ngày.',
        'Tăng dần rau, trái cây mềm và các bữa có chất xơ thay vì tăng đột ngột.',
        'Đi bộ nhẹ sau ăn để kích thích ruột làm việc đều hơn.'
      ],
      reassurance: 'Điều chỉnh nhịp ăn uống và vận động nhẹ thường giúp ruột làm việc ổn hơn nhiều so với chờ thuốc.',
      warningSigns: 'Nếu táo bón kéo dài, đau nhiều, chảy máu hoặc bụng chướng rõ, mẹ nên đi khám để được hướng dẫn phù hợp.',
      ctas: [
        'Muốn mình làm thực đơn 1 ngày hỗ trợ giảm táo bón cho mẹ bầu, comment TIÊU HÓA nhé.',
        'Nếu cần checklist ăn uống để ruột dễ chịu hơn, để lại chữ TÁO BÓN nha.'
      ]
    };
  }

  if (containsAny(rawText, ['gọi sữa', 'ít sữa', 'mất sữa', 'tắc tia', 'sữa mẹ'])) {
    return {
      subject: 'sữa mẹ sau sinh',
      explanation: 'Nguồn sữa sau sinh không chỉ phụ thuộc vào cơ địa mà còn liên quan đến việc cho bé bú, hút sữa và nghỉ ngơi có đều hay không.',
      whyReasons: [
        'Nếu bé bú chưa hiệu quả hoặc cữ bú thưa, cơ thể sẽ nhận tín hiệu tạo sữa kém hơn.',
        'Mẹ quá mệt, thiếu ngủ hoặc bỏ cữ hút sữa thường làm lượng sữa dao động rõ.',
        'Ngực căng mà không được làm trống tương đối đều có thể khiến sữa xuống kém và dễ khó chịu hơn.'
      ],
      quickActions: [
        'Ưu tiên cho bú hoặc hút sữa đều theo cữ thay vì chờ ngực quá căng.',
        'Kiểm tra lại khớp ngậm của bé hoặc lực hút để tránh làm mẹ đau mà sữa ra không hiệu quả.',
        'Ăn uống đủ, uống nước đều và tranh thủ nghỉ bất cứ khi nào có thể để cơ thể hồi lại.'
      ],
      reassurance: 'Điều quan trọng là tạo nhịp đều cho cơ thể, vì sữa thường phản ứng tốt hơn với sự ổn định hơn là cố ép một lúc.',
      warningSigns: 'Nếu ngực đỏ nóng, sốt, đau tăng hoặc sờ thấy vùng cứng kéo dài, mẹ nên đi khám để tránh viêm tắc nặng hơn.',
      ctas: [
        'Comment SỮA MẸ nếu bạn muốn mình làm lịch hút sữa cơ bản cho mẹ mới sinh.',
        'Muốn mình viết tiếp phần xử lý căng tức và tắc tia nhẹ tại nhà, để lại chữ SỮA nhé.'
      ]
    };
  }

  if (containsAny(rawText, ['lợi sữa', 'loi sua']) && containsAny(rawText, ['canh', 'món canh', 'mon canh'])) {
    return {
      subject: 'món canh lợi sữa sau sinh',
      explanation: 'Canh lợi sữa hiệu quả nhất khi đi cùng nguyên tắc đủ nước, đủ đạm và ăn đều cữ, thay vì chỉ trông chờ vào một món riêng lẻ.',
      whyReasons: [
        'Mẹ sau sinh cần nhiều nước và năng lượng để cơ thể duy trì tạo sữa ổn định hơn.',
        'Canh ấm, dễ ăn giúp mẹ bổ sung nước và đạm thuận lợi hơn trong giai đoạn mệt sau sinh.',
        'Luân phiên nhiều món giúp bữa ăn đỡ ngán và dễ duy trì đều trong tuần.'
      ],
      quickActions: [
        'Giữ 2 bữa canh trong ngày, ưu tiên bữa trưa và bữa tối.',
        'Mỗi bữa canh thêm nguồn đạm rõ như thịt nạc, tôm, cá hoặc trứng.',
        'Uống thêm nước ấm xen kẽ giữa các cữ để tổng lượng nước trong ngày đủ hơn.'
      ],
      recommendations: [
        'Ưu tiên món canh dễ tiêu, nấu loãng vừa để mẹ dễ ăn và tăng lượng nước.',
        'Đa dạng rau củ và nguồn đạm để khẩu phần không bị lặp đơn điệu.',
        'Duy trì đều 5 đến 7 ngày rồi theo dõi phản hồi lượng sữa và thể trạng của mẹ.'
      ],
      avoidList: [
        'Không phụ thuộc duy nhất vào một món canh rồi bỏ qua bữa chính.',
        'Tránh ăn quá mặn vì có thể làm mẹ khát và mệt hơn.',
        'Không bỏ cữ bú/hút vì đây mới là tín hiệu quan trọng cho cơ thể tạo sữa.'
      ],
      reassurance: 'Món canh là công cụ hỗ trợ rất tốt, nhưng hiệu quả bền nhất vẫn đến từ ăn đủ, ngủ nghỉ và cho bú hoặc hút đều cữ.',
      warningSigns: 'Nếu mẹ sốt, ngực đỏ nóng, đau tăng hoặc sờ thấy cục cứng kéo dài, nên đi khám để được xử lý sớm.',
      ctas: [
        'Comment CANH để mình gửi thực đơn canh lợi sữa 7 ngày dễ nấu tại nhà.',
        'Muốn mình làm tiếp phần thời điểm ăn canh theo từng cữ bú, để lại chữ LỢI SỮA nhé.'
      ]
    };
  }

  if (containsAny(rawText, ['vào con không vào mẹ', 'ăn gì để vào con', 'ăn gì khi mang thai', 'thực đơn mẹ bầu'])) {
    return {
      subject: 'ăn uống thai kỳ để tăng cân hợp lý',
      explanation: 'Ăn để vào con không vào mẹ nghĩa là ưu tiên bữa đủ đạm, chất béo tốt và chất xơ, thay vì tăng nhiều tinh bột nhanh hoặc đồ ngọt.',
      whyReasons: [
        'Mẹ cần đủ đạm mỗi bữa để hỗ trợ thai nhi phát triển mà không làm đường huyết lên xuống mạnh.',
        'Tinh bột hấp thu chậm và rau giúp no lâu, giảm cảm giác thèm đồ ngọt liên tục.',
        'Ăn chia nhỏ và đúng giờ giúp cơ thể dùng năng lượng ổn định hơn thay vì tích mỡ nhanh.'
      ],
      quickActions: [
        'Mỗi bữa giữ nguyên tắc đĩa ăn: nửa đĩa rau, một phần tư đạm, một phần tư tinh bột chậm.',
        'Ưu tiên nguồn đạm dễ làm như trứng, cá, thịt nạc, đậu hũ và sữa chua không đường.',
        'Đổi snack ngọt thành trái cây ít ngọt kèm hạt hoặc sữa chua để đỡ tăng đường huyết.'
      ],
      recommendations: [
        'Gợi ý 1: Bữa sáng có đạm + tinh bột chậm, ví dụ bánh mì nguyên cám với trứng và rau.',
        'Gợi ý 2: Bữa trưa/tối ưu tiên cá, thịt nạc hoặc đậu hũ, ăn cùng nhiều rau và cơm vừa phải.',
        'Gợi ý 3: 1-2 bữa phụ nhỏ bằng sữa chua không đường, trái cây ít ngọt hoặc hạt không tẩm đường.'
      ],
      avoidList: [
        'Hạn chế nước ngọt, trà sữa, bánh ngọt nhiều đường.',
        'Không bỏ bữa rồi ăn bù quá nhiều vào tối muộn.',
        'Tránh ăn theo trend giảm cân cực đoan khi đang mang thai.'
      ],
      reassurance: 'Mẹ không cần ăn kiêng khắt khe; chỉ cần ăn đúng cấu trúc bữa là cân nặng thường dễ kiểm soát hơn.',
      warningSigns: 'Nếu mẹ tăng cân quá nhanh hoặc có nguy cơ đái tháo đường thai kỳ, nên được bác sĩ/dinh dưỡng theo dõi thực đơn cụ thể.',
      ctas: [
        'Comment THỰC ĐƠN để mình làm mẫu ăn 1 ngày theo kiểu vào con không vào mẹ.',
        'Muốn mình viết luôn danh sách đi chợ 7 ngày cho mẹ bầu, để lại chữ DINH DƯỠNG nhé.'
      ]
    };
  }

  if (containsAny(rawText, ['khô da', 'dưỡng ẩm', 'sản phẩm nào', 'kem dưỡng', 'chăm da mẹ bầu'])) {
    return {
      subject: 'chọn sản phẩm chăm da cho mẹ bầu',
      explanation: 'Với mẹ bầu da khô, ưu tiên sản phẩm dịu nhẹ, cấp ẩm tốt và thành phần rõ ràng thay vì chạy theo sản phẩm có hoạt chất mạnh.',
      whyReasons: [
        'Da thai kỳ dễ nhạy cảm hơn nên hương liệu hoặc cồn mạnh có thể làm da khô rát hơn.',
        'Hàng rào da khi thiếu ẩm sẽ gây căng rít, bong nhẹ và dễ kích ứng khi thời tiết thay đổi.',
        'Chọn sai kết cấu hoặc dùng quá nhiều lớp hoạt chất dễ làm da bí và khó chịu.'
      ],
      quickActions: [
        'Rửa mặt dịu nhẹ, bôi dưỡng ẩm ngay khi da còn ẩm nhẹ sau rửa mặt hoặc tắm.',
        'Ưu tiên kem dưỡng có nhóm hút ẩm và phục hồi như glycerin, hyaluronic acid, ceramide.',
        'Ban ngày thoa chống nắng phù hợp da nhạy cảm để giảm khô và xỉn màu do nắng.'
      ],
      recommendations: [
        'Gợi ý 1: Chọn sữa rửa mặt pH dịu, không hạt scrub và không mùi nồng.',
        'Gợi ý 2: Chọn kem dưỡng có glycerin/ceramide/panthenol để giữ ẩm bền hơn.',
        'Gợi ý 3: Nếu thử sản phẩm mới, patch test vùng nhỏ 2-3 ngày trước khi bôi toàn mặt.'
      ],
      avoidList: [
        'Tránh lạm dụng tẩy da chết mạnh khi da đang khô rát.',
        'Hạn chế tự kết hợp quá nhiều active trong cùng routine.',
        'Nếu có thai kỳ nguy cơ cao, nên hỏi bác sĩ trước khi dùng treatment mới.'
      ],
      reassurance: 'Routine càng đơn giản, đều đặn và hợp da thì càng dễ thấy da ổn định trở lại.',
      warningSigns: 'Nếu da đỏ rát kéo dài, ngứa nhiều hoặc nổi mẩn lan rộng, nên đi khám da liễu để điều chỉnh phù hợp.',
      ctas: [
        'Comment KHÔ DA để mình gợi ý routine 3 bước sáng tối cho mẹ bầu da khô.',
        'Muốn mình làm checklist đọc bảng thành phần nhanh, để lại chữ INGREDIENT nhé.'
      ]
    };
  }

  // ── Category-aware fallback ──────────────────────────────────────
  const cat = detectTopicCategory(rawText);
  return buildCategoryKnowledge(cat, subject, rawText);
}

function detectTopicCategory(rawText) {
  if (containsAny(rawText, ['đau đầu', 'nhức đầu', 'đầu nặng', 'đầu choáng'])) return 'headache';
  if (containsAny(rawText, ['buồn nôn', 'ốm nghén', 'nôn ói', 'nghén nặng', 'nghén'])) return 'nausea';
  if (containsAny(rawText, ['đau bụng', 'co thắt tử cung', 'co bóp', 'bụng co'])) return 'abdominal';
  if (containsAny(rawText, ['ợ nóng', 'trào ngược', 'đầy hơi', 'khó tiêu', 'chướng bụng', 'đầy bụng', 'ợ chua'])) return 'digestion';
  if (containsAny(rawText, ['lo âu', 'lo lắng', 'trầm cảm', 'stress', 'căng thẳng', 'tâm lý', 'sợ hãi', 'hoảng loạn', 'lo sợ'])) return 'mental';
  if (containsAny(rawText, ['mệt mỏi', 'kiệt sức', 'uể oải', 'không có sức', 'mệt lả', 'mệt xỉu'])) return 'fatigue';
  if (containsAny(rawText, ['tăng cân', 'béo', 'cân nặng', 'giảm cân', 'thừa cân', 'to bụng'])) return 'weight';
  if (containsAny(rawText, ['da ngứa', 'ngứa da', 'mụn', 'da nổi', 'da bong', 'da nhạy', 'da dầu', 'nám da', 'tàn nhang', 'vết thâm'])) return 'skin_issue';
  if (containsAny(rawText, ['thai nhi', 'vận động thai', 'siêu âm', 'tim thai', 'em bé trong bụng', 'thai máy', 'thai đạp'])) return 'baby';
  if (containsAny(rawText, ['cho bú', 'bú mẹ', 'cai sữa', 'sữa công thức', 'vắt sữa', 'núm vú', 'tắc tia sữa', 'bú bình'])) return 'breastfeeding_care';
  if (containsAny(rawText, ['dinh dưỡng', 'thực phẩm', 'ăn gì', 'nên ăn', 'không nên ăn', 'bổ sung', 'vitamin', 'thực đơn', 'chế độ ăn'])) return 'nutrition';
  if (containsAny(rawText, ['tập thể dục', 'bài tập', 'yoga', 'đi bộ', 'vận động', 'thể dục'])) return 'exercise';
  if (containsAny(rawText, ['phục hồi', 'sau sinh', 'hậu sản', 'eo thon', 'bụng sau sinh', 'vóc dáng sau sinh'])) return 'postpartum_recovery';
  if (rawText.includes('đau')) return 'pain_generic';
  return 'general_pregnancy';
}

function buildCategoryKnowledge(cat, subject, rawText) {
  const base = {
    ctas: [
      `Muốn mình làm tiếp video chi tiết hơn về ${subject}, comment CHI TIẾT nhé.`,
      `Nếu cần checklist nhanh cho ${subject}, để lại chữ CHECKLIST nha.`
    ]
  };

  if (cat === 'headache') return Object.assign({}, base, {
    subject,
    explanation: `Đau đầu khi mang thai là phản ứng khá phổ biến, nhưng không phải lúc nào cũng có nguyên nhân giống nhau, nên cần hiểu đúng để xử lý đúng.`,
    whyReasons: [
      'Trong 3 tháng đầu, hormone hCG và estrogen tăng đột ngột làm giãn mạch máu não, gây ra những cơn đau đầu âm ỉ hoặc theo nhịp đập.',
      'Thiếu nước là yếu tố rất hay bị bỏ qua — khi mang thai nhu cầu nước tăng cao nhưng nhiều mẹ lại uống ít đi vì buồn nôn.',
      'Mệt mỏi, stress hoặc căng cơ vùng cổ vai gáy khi ngồi sai tư thế cũng là nguyên nhân phổ biến gây ra cơn đau đầu kéo dài.'
    ],
    quickActions: [
      'Uống ngay một ly nước mát và nghỉ ngơi ở phòng yên tĩnh, không ánh đèn mạnh trong 15-20 phút.',
      'Đặt khăn ướt mát lên trán và bóp nhẹ huyệt thái dương theo vòng tròn nhỏ trong 2 phút.',
      'Kiểm tra tư thế ngồi — kê gối lưng, đặt màn hình ngang tầm mắt, tránh cúi cổ kéo dài.'
    ],
    recommendations: [
      'Uống đủ 2-2,5 lít nước mỗi ngày, chia nhỏ nhiều lần để cơ thể hấp thu đều hơn.',
      'Nếu đau đầu hay xuất hiện vào buổi sáng, kiểm tra lại chất lượng giấc ngủ và kê gối đầu đúng độ cao.',
      `Thực phẩm giàu magie như hạnh nhân, chuối và rau xanh có thể hỗ trợ giảm tần suất cơn ${subject}.`
    ],
    avoidList: [
      'Không tự ý dùng thuốc đau đầu khi chưa hỏi bác sĩ, vì nhiều loại không an toàn trong thai kỳ.',
      'Tránh nơi có mùi mạnh như khói thuốc, nước hoa nồng vì dễ kích hoạt hoặc kéo dài cơn đau.',
      'Không nhịn ăn hoặc bỏ bữa vì hạ đường huyết là một nguyên nhân trực tiếp gây đau đầu.'
    ],
    reassurance: 'Cơn đau đầu trong thai kỳ thường giảm rõ sau 3 tháng đầu khi hormone ổn định hơn — mẹ không cần lo quá nhưng nên theo dõi kỹ.',
    warningSigns: 'Đi khám ngay nếu đau đầu dữ dội đột ngột, kèm mờ mắt, phù tay chân tăng nhanh hoặc đau không dứt sau khi nghỉ ngơi.'
  });

  if (cat === 'nausea') return Object.assign({}, base, {
    subject,
    explanation: `Ốm nghén không chỉ là "khó chịu bình thường" mà là dấu hiệu cơ thể đang điều chỉnh mạnh để nuôi thai — hiểu đúng sẽ giúp mẹ vượt qua nhẹ nhàng hơn.`,
    whyReasons: [
      'Hormone hCG tăng vọt trong 3 tháng đầu là nguyên nhân chính — buồn nôn thường nặng nhất khi hCG đạt đỉnh, rồi giảm dần sau tuần 12-14.',
      'Dạ dày trống hoặc đầy quá mức đều kích thích cảm giác buồn nôn — ăn quá nhiều cùng lúc hoặc nhịn quá lâu đều làm nghén tệ hơn.',
      'Mùi hương và thức ăn nhạy cảm hơn hẳn trong thai kỳ do khứu giác thay đổi, nên những thứ trước đây bình thường giờ có thể gây nôn.'
    ],
    quickActions: [
      'Ăn bánh quy khô hoặc cơm trắng ngay khi vừa thức dậy, trước khi đứng dậy khỏi giường.',
      'Ngậm một lát gừng tươi hoặc uống trà gừng loãng ấm — gừng được chứng minh giảm buồn nôn an toàn trong thai kỳ.',
      'Chia nhỏ thành 5-6 bữa trong ngày thay vì 3 bữa lớn để dạ dày không bao giờ hoàn toàn trống.'
    ],
    recommendations: [
      'Ưu tiên thức ăn nhạt, nguội hoặc ít mùi vì mùi thức ăn nóng thường kích thích buồn nôn mạnh hơn.',
      'Uống nước từng ngụm nhỏ và thường xuyên thay vì uống nhiều một lúc để tránh đầy dạ dày.',
      'Vitamin B6 đã được chứng minh hỗ trợ giảm nghén — hỏi bác sĩ về liều lượng phù hợp.'
    ],
    avoidList: [
      'Tránh thức ăn cay, nhiều dầu mỡ hoặc mùi mạnh trong giai đoạn nghén nặng.',
      'Không nằm ngay sau ăn vì dễ trào ngược và làm buồn nôn tệ hơn.',
      'Không nhịn ăn để tránh buồn nôn vì điều này thường phản tác dụng.'
    ],
    reassurance: 'Nghén nặng thường là dấu hiệu thai đang phát triển tốt — phần lớn mẹ sẽ thấy đỡ hẳn sau tuần 12 đến 16.',
    warningSigns: 'Nếu nôn nhiều hơn 3-4 lần/ngày liên tục, không giữ được nước uống hoặc sụt cân nhanh thì cần đến bệnh viện ngay để được truyền dịch.'
  });

  if (cat === 'abdominal') return Object.assign({}, base, {
    subject,
    explanation: `Cảm giác đau hoặc căng bụng khi mang thai thường đến từ nhiều nguồn khác nhau — nhận biết đúng loại đau sẽ giúp mẹ biết khi nào cần lo và khi nào có thể bình tĩnh.`,
    whyReasons: [
      'Tử cung giãn nở liên tục kéo dây chằng tròn hai bên gây ra những cơn đau nhói ngắn, thường rõ hơn khi mẹ đổi tư thế nhanh hoặc ho hắt hơi.',
      'Ruột và dạ dày bị chèn ép khi tử cung lớn dần gây đầy hơi, chuột rút nhẹ hoặc khó chịu vùng bụng không phân biệt rõ vị trí.',
      'Căng thẳng, thiếu nước hoặc vận động quá sức đột ngột có thể gây co thắt tử cung sinh lý, thường tự hết trong vài phút.'
    ],
    quickActions: [
      'Nằm nghiêng trái, thở sâu và thả lỏng bụng — tư thế này giảm áp lực lên tử cung và dây chằng nhanh nhất.',
      'Uống một ly nước ấm để kiểm tra xem cơn đau có do mất nước hoặc đầy hơi không.',
      'Đặt tay lên bụng và theo dõi nhịp, thời gian cơn đau để phân biệt co sinh lý với co thắt thật sự.'
    ],
    recommendations: [
      'Đổi tư thế từ từ, tránh đứng dậy hoặc ngồi xuống đột ngột để không kéo căng dây chằng.',
      'Mặc quần áo rộng, không thắt nịt bụng hoặc mặc đồ bó vùng bụng khi đang có cơn đau.',
      'Ghi lại tần suất, vị trí và mức độ cơn đau để báo bác sĩ khi đi khám định kỳ.'
    ],
    avoidList: [
      'Không tự chườm nóng trực tiếp lên bụng khi chưa biết nguyên nhân.',
      'Không cố gắng tiếp tục vận động nặng khi cơn đau đang xuất hiện.',
      'Không bỏ qua nếu đau kèm theo ra máu hoặc dịch bất thường.'
    ],
    reassurance: 'Hầu hết cơn đau bụng nhẹ, thoáng qua khi mang thai là sinh lý bình thường — tử cung đang làm việc để nuôi bé lớn.',
    warningSigns: 'Cần đến cấp cứu ngay nếu đau bụng dữ dội không giảm, co thắt đều đặn dưới 10 phút/lần, hoặc kèm ra máu, dịch ối.'
  });

  if (cat === 'digestion') return Object.assign({}, base, {
    subject,
    explanation: `Vấn đề tiêu hóa như ${subject} cực kỳ phổ biến khi mang thai và sau sinh — nguyên nhân chủ yếu đến từ hormone và sự thay đổi vị trí các cơ quan nội tạng.`,
    whyReasons: [
      'Hormone progesterone làm giãn cơ trơn toàn thân kể cả cơ vòng thực quản, khiến axit dạ dày dễ trào ngược lên gây ợ nóng và khó chịu.',
      'Tử cung ngày càng lớn đẩy dạ dày lên cao và giảm thể tích chứa đựng, nên ăn một lượng bình thường cũng dễ gây đầy và ợ hơi.',
      'Ruột co bóp chậm hơn do hormone làm thức ăn đi qua chậm hơn, gây cảm giác chướng bụng và khó tiêu kéo dài.'
    ],
    quickActions: [
      'Ăn chậm, nhai kỹ và ngồi thẳng lưng trong và sau bữa ăn ít nhất 30 phút.',
      'Kê cao đầu giường thêm 15-20 cm bằng gối hoặc nêm giường để giảm trào ngược khi nằm.',
      'Uống nước ấm với một lát gừng hoặc nước chanh loãng sau bữa ăn để hỗ trợ tiêu hóa.'
    ],
    recommendations: [
      'Chia 5-6 bữa nhỏ thay vì 3 bữa lớn — dạ dày ít phải làm việc quá tải hơn.',
      'Ưu tiên thức ăn mềm, ít dầu mỡ, ít cay và ít axit trong giai đoạn nặng.',
      'Đi bộ nhẹ 10-15 phút sau bữa ăn giúp ruột co bóp tốt hơn và giảm đầy hơi.'
    ],
    avoidList: [
      'Tránh các loại thực phẩm kích thích axit như cà phê, nước ngọt có ga, thức ăn chua và cay.',
      'Không nằm ngay sau ăn — cần chờ ít nhất 1-2 tiếng.',
      'Tránh mặc quần áo bó bụng sau bữa ăn vì tăng áp lực lên dạ dày.'
    ],
    reassurance: `${subject} khi mang thai thường cải thiện rõ sau khi sinh vì hormone ổn định và tử cung không còn chèn ép dạ dày nữa.`,
    warningSigns: 'Đi khám nếu đau thượng vị dữ dội, nôn ra máu, phân có màu đen hoặc cơn ợ nóng không giảm dù đã thay đổi thói quen ăn uống.'
  });

  if (cat === 'mental') return Object.assign({}, base, {
    subject,
    explanation: `Cảm xúc thăng trầm, lo âu hay stress khi mang thai và sau sinh là phản ứng hoàn toàn có cơ sở về mặt sinh lý — không phải mẹ yếu đuối mà là cơ thể đang chịu áp lực rất lớn.`,
    whyReasons: [
      'Hormone thai kỳ và sau sinh biến động mạnh tác động trực tiếp lên hệ thần kinh trung ương, làm dao động tâm trạng, dễ xúc động và khó kiểm soát cảm xúc hơn bình thường.',
      'Cơ thể mệt mỏi, thiếu ngủ kéo dài làm giảm khả năng điều tiết cảm xúc, khiến những vấn đề nhỏ trong ngày trở nên nặng nề hơn rất nhiều.',
      'Áp lực thay đổi vai trò, lo lắng về sức khỏe con, tài chính hoặc thiếu sự hỗ trợ từ người thân đều cộng hưởng làm tình trạng tâm lý dễ trở nặng.'
    ],
    quickActions: [
      'Thở sâu 4-7-8: hít vào 4 giây, nín 7 giây, thở ra 8 giây — làm 3 lần liên tiếp để hệ thần kinh bình tĩnh nhanh.',
      'Chia sẻ cảm xúc với người thân tin tưởng hoặc viết ra giấy — đừng giữ một mình vì cảm giác cô đơn làm stress tăng nhanh hơn.',
      'Ra ngoài thoáng khí 10-15 phút và nhìn cây xanh hoặc trời xanh — ánh sáng tự nhiên cải thiện tâm trạng có cơ sở khoa học rõ ràng.'
    ],
    recommendations: [
      'Đặt kỳ vọng thực tế — không cần hoàn hảo, chỉ cần đủ tốt cho bé là đủ.',
      'Nhờ sự hỗ trợ chủ động từ chồng hoặc người thân trong những việc cụ thể, không đợi họ tự biết.',
      'Các bài tập nhẹ như yoga cho bà bầu, đi bộ buổi sáng hoặc thở thiền đều có hiệu quả giảm stress được ghi nhận.'
    ],
    avoidList: [
      'Tránh so sánh hành trình của mình với người khác trên mạng xã hội — mỗi thai kỳ và mỗi mẹ đều khác nhau.',
      'Không bỏ qua các dấu hiệu tâm lý kéo dài vì trầm cảm sau sinh cần được điều trị chứ không tự khỏi.',
      'Tránh cô lập bản thân — kết nối xã hội là liều thuốc tâm lý hiệu quả.'
    ],
    reassurance: 'Cảm giác lo lắng hay bất an không có nghĩa là mẹ đang làm sai — đó là dấu hiệu mẹ quan tâm và đang cố gắng hết sức.',
    warningSigns: 'Nếu buồn bã, không thiết gì hoặc có suy nghĩ tiêu cực kéo dài hơn 2 tuần, hãy nói chuyện với bác sĩ hoặc chuyên gia tâm lý.'
  });

  if (cat === 'fatigue') return Object.assign({}, base, {
    subject,
    explanation: `Mệt mỏi trong thai kỳ không giống mệt thông thường — đây là loại kiệt sức sâu do cơ thể đang làm việc gấp đôi bình thường để nuôi một sinh linh đang lớn.`,
    whyReasons: [
      'Trong 3 tháng đầu, cơ thể tăng tốc sản xuất máu, hormone và các cơ quan nhau thai, tiêu hao năng lượng khổng lồ dù mẹ không làm gì nhiều.',
      'Thiếu sắt và thiếu máu là nguyên nhân phổ biến nhất gây mệt mỏi kéo dài — lượng sắt cần tăng gần gấp đôi khi mang thai nhưng hấp thu lại khó hơn.',
      'Chất lượng giấc ngủ giảm do đau, khó tìm tư thế nằm, tiểu đêm hoặc lo lắng, khiến mẹ thức dậy không cảm thấy nghỉ ngơi thực sự.'
    ],
    quickActions: [
      'Cho phép mình nghỉ giữa ngày 15-20 phút — giấc ngủ trưa ngắn có thể phục hồi năng lượng đáng kể.',
      'Ăn một bữa nhẹ giàu protein và carb phức sau mỗi 3-4 tiếng để duy trì đường huyết ổn định, tránh tụt sức đột ngột.',
      'Đi bộ nhẹ 10 phút vào buổi sáng — vận động nhẹ nghịch lý lại giúp tăng năng lượng hơn là nằm nghỉ thêm.'
    ],
    recommendations: [
      'Xét nghiệm máu định kỳ để kiểm tra ferritin và hemoglobin vì thiếu sắt im lặng rất phổ biến.',
      'Bổ sung sắt theo chỉ định bác sĩ kết hợp với vitamin C để tăng hấp thu.',
      'Sắp xếp công việc nhà và cá nhân theo mức độ ưu tiên, nhờ người thân hỗ trợ những việc không thực sự cần mẹ làm.'
    ],
    avoidList: [
      'Không dùng cà phê hoặc nước tăng lực để chống mệt — caffeine trong thai kỳ cần hạn chế dưới 200mg/ngày.',
      'Không cố sức làm hết mọi việc khi cơ thể đang báo hiệu cần nghỉ.',
      'Tránh bỏ bữa — thiếu dinh dưỡng làm mệt mỏi tăng nhanh hơn.'
    ],
    reassurance: 'Mệt mỏi trong thai kỳ thường là dấu hiệu cơ thể đang làm đúng việc của nó — và cơn mệt tháng đầu thường giảm rõ khi vào tam cá nguyệt thứ hai.',
    warningSigns: 'Nếu mệt cực độ kèm da xanh, tim đập nhanh, khó thở hoặc hoa mắt ngay khi đứng lên, cần xét nghiệm máu sớm để kiểm tra thiếu máu.'
  });

  if (cat === 'weight') return Object.assign({}, base, {
    subject,
    explanation: `${subject} trong thai kỳ là chủ đề nhiều mẹ lo lắng, nhưng quan trọng hơn con số trên cân là chất lượng tăng cân và tốc độ phù hợp với từng giai đoạn.`,
    whyReasons: [
      'Cơ thể tích nước nhiều hơn bình thường trong thai kỳ — khoảng 1-1,5 lít máu bổ sung, dịch ối và mô nhau thai đóng góp đáng kể vào tổng cân nặng.',
      'Tốc độ trao đổi chất thay đổi theo từng tam cá nguyệt — một số mẹ tăng chậm lúc đầu nhưng tăng nhanh hơn ở giai đoạn sau, điều này hoàn toàn bình thường.',
      'Ăn nhiều hơn để đáp ứng nhu cầu của thai nhi là cần thiết, nhưng chất lượng dinh dưỡng quan trọng hơn nhiều so với số lượng calo.'
    ],
    quickActions: [
      'Cân mình cùng giờ, cùng điều kiện mỗi tuần một lần thay vì mỗi ngày để có số liệu chính xác hơn.',
      'Ghi nhật ký ăn uống trong 3 ngày để nhận ra đang dư hay thiếu nhóm thực phẩm nào.',
      'Trao đổi với bác sĩ về khung cân nặng phù hợp với BMI trước khi mang thai của mình.'
    ],
    recommendations: [
      'BMI bình thường trước thai kỳ nên tăng khoảng 11-16kg trong suốt thai kỳ — không cần ép theo con số này mà theo dõi xu hướng.',
      'Thay thế đồ ăn vặt bằng trái cây, các loại hạt và sữa chua để vẫn đủ năng lượng mà không tăng cân nhanh quá mức.',
      'Vận động nhẹ đều đặn giúp kiểm soát cân nặng và còn hỗ trợ sức khỏe tim mạch cho cả mẹ và bé.'
    ],
    avoidList: [
      'Không ăn kiêng hoặc cắt giảm calo mạnh khi mang thai vì thai nhi cần đủ dưỡng chất liên tục.',
      'Không căng thẳng quá vì số đo cân — stress cũng có thể gây tích nước và tăng cân.',
      'Tránh so sánh với người khác vì mỗi cơ thể phản ứng với thai kỳ khác nhau.'
    ],
    reassurance: 'Phần lớn cân nặng thai kỳ sẽ tự giảm trong 6-12 tháng đầu sau sinh nếu mẹ ăn uống hợp lý và cho con bú — cơ thể có cơ chế điều chỉnh tự nhiên.',
    warningSigns: 'Tăng cân quá nhanh đột ngột kèm phù tay mặt có thể là dấu hiệu tiền sản giật — cần đến bệnh viện kiểm tra ngay.'
  });

  if (cat === 'skin_issue') return Object.assign({}, base, {
    subject,
    explanation: `Vấn đề da như ${subject} khi mang thai và sau sinh rất phổ biến do hormone làm thay đổi hoạt động của tuyến bã nhờn, tốc độ tái tạo tế bào da và phản ứng miễn dịch.`,
    whyReasons: [
      'Estrogen và progesterone tăng cao kích thích tuyến bã nhờn hoạt động mạnh hơn, da dễ nổi mụn hoặc dầu hơn dù trước đây không như vậy.',
      'Sự căng giãn da ở vùng bụng, đùi và ngực diễn ra quá nhanh khiến các sợi collagen và elastin không kịp thích nghi, gây ngứa và dễ hình thành vết rạn.',
      'Hệ miễn dịch thay đổi trong thai kỳ làm da nhạy cảm hơn với nhiệt độ, hóa chất và ánh nắng.'
    ],
    quickActions: [
      'Dưỡng ẩm vùng bụng, đùi và ngực ngay sau khi tắm khi da còn ẩm để khóa ẩm hiệu quả nhất.',
      'Dùng sản phẩm không mùi, không paraben và không retinol khi mang thai vì nhiều thành phần trong mỹ phẩm không an toàn.',
      'Mặc quần áo cotton mềm, rộng để giảm ma sát và kích ứng da vùng đang nhạy cảm.'
    ],
    recommendations: [
      'Uống đủ nước và ăn nhiều rau xanh, trái cây để cung cấp antioxidant hỗ trợ tái tạo da từ bên trong.',
      'Thoa kem chống nắng SPF 30+ mỗi ngày vì da mang thai nhạy cảm hơn và dễ nám khi tiếp xúc UV.',
      'Các thành phần lành tính an toàn trong thai kỳ: shea butter, vitamin E tự nhiên, hyaluronic acid, dầu hướng dương.'
    ],
    avoidList: [
      'Tuyệt đối tránh retinol, retinoids và các dẫn xuất vitamin A trong thai kỳ vì ảnh hưởng đến thai nhi.',
      'Không nặn mụn hoặc cào gãi vùng ngứa vì dễ để lại sẹo và nhiễm trùng khi da đang nhạy cảm.',
      'Tránh tắm nước nóng quá vì làm da mất độ ẩm tự nhiên nhanh hơn.'
    ],
    reassurance: `Phần lớn vấn đề về ${subject} trong thai kỳ sẽ cải thiện sau khi sinh và hormone ổn định trở lại — kiên nhẫn và chăm sóc đúng cách là đủ.`,
    warningSigns: 'Đi khám nếu phát ban đột ngột toàn thân, ngứa dữ dội kèm vàng da hoặc mụn mủ lan rộng vì có thể liên quan đến bệnh lý cần điều trị.'
  });

  if (cat === 'baby') return Object.assign({}, base, {
    subject,
    explanation: `Theo dõi sự phát triển của thai nhi là một trong những phần quan trọng nhất của thai kỳ — hiểu đúng giúp mẹ an tâm hơn và biết khi nào cần chú ý hơn.`,
    whyReasons: [
      'Thai nhi bắt đầu vận động rõ từ tuần 18-20 với con đầu và tuần 16-18 với con thứ — cảm giác "máy nhẹ" hay "lật người" là dấu hiệu bé hoạt động bình thường.',
      'Siêu âm định kỳ không chỉ để xem hình ảnh bé mà còn đánh giá tuần tuổi thai, lượng nước ối, vị trí nhau thai và phát hiện sớm bất thường.',
      'Tim thai bình thường từ 120-160 nhịp/phút — nghe thấy tim thai qua doppler từ tuần 10-12 là cột mốc quan trọng.'
    ],
    quickActions: [
      'Đếm cử động thai mỗi ngày: nằm nghiêng trái sau bữa ăn và đếm đủ 10 cử động trong vòng 2 tiếng.',
      'Ghi lại lịch siêu âm và xét nghiệm theo đúng phác đồ để không bỏ lỡ mốc quan trọng.',
      'Nói chuyện nhẹ với bé mỗi ngày — từ tuần 18 trở đi bé đã nghe được âm thanh từ bên ngoài.'
    ],
    recommendations: [
      'Bổ sung đủ DHA từ cá biển ít thủy ngân, hạt chia hoặc viên DHA để hỗ trợ phát triển não bộ của bé.',
      'Theo dõi tăng trưởng của bé qua các chỉ số siêu âm BPD, HC, AC, FL và hỏi bác sĩ khi có thắc mắc cụ thể.',
      'Đọc sách, nghe nhạc nhẹ hoặc thiền định cũng gián tiếp tốt cho bé qua hormone cortisol của mẹ thấp hơn.'
    ],
    avoidList: [
      'Không tự ý dùng thuốc, kể cả thảo dược, khi chưa hỏi bác sĩ vì nhiều loại ảnh hưởng trực tiếp đến thai nhi.',
      'Tránh tiếp xúc với hóa chất mạnh, khói thuốc lá và môi trường ô nhiễm.',
      'Không lo lắng quá về những chỉ số nhỏ lệch chuẩn — hãy hỏi bác sĩ thay vì tự tra mạng.'
    ],
    reassurance: 'Cơ thể mẹ được thiết kế để bảo vệ và nuôi dưỡng bé tốt nhất có thể — chỉ cần thăm khám đúng lịch và lắng nghe cơ thể mình.',
    warningSigns: 'Đến bệnh viện ngay nếu bé không đạp trong 12 tiếng, ra nước ối, chảy máu hoặc đau bụng liên tục.'
  });

  if (cat === 'breastfeeding_care') return Object.assign({}, base, {
    subject,
    explanation: `Nuôi con bằng sữa mẹ là hành trình cần học — không phải mẹ nào cũng tự nhiên biết từ đầu, và hầu hết khó khăn đều có giải pháp cụ thể.`,
    whyReasons: [
      'Hormone prolactin sản xuất sữa và oxytocin kích sữa chảy cần được kích thích thường xuyên — càng cho bú hoặc vắt nhiều thì sữa càng về nhiều.',
      'Khớp ngậm sai là nguyên nhân hàng đầu gây đau núm vú, tắc tia sữa và lượng sữa ít — bé cần ngậm cả quầng vú chứ không chỉ núm vú.',
      'Stress, mệt mỏi và thiếu nước ảnh hưởng trực tiếp đến lượng sữa — hormone cortisol cao ức chế hormone sữa mẹ.'
    ],
    quickActions: [
      'Kiểm tra khớp ngậm: miệng bé mở rộng, môi dưới lật ra ngoài, cằm chạm ngực mẹ — đây là khớp ngậm chuẩn.',
      'Uống một ly nước ấm ngay trước và trong khi cho bú để bù lượng dịch mất qua sữa.',
      'Massage nhẹ tuyến sữa từ ngoài vào trong trước khi cho bú để kích thích sữa xuống đều.'
    ],
    recommendations: [
      'Cho bú hoặc vắt đều đặn 8-12 lần trong 24 giờ ở giai đoạn đầu để thiết lập nguồn sữa ổn định.',
      'Ăn đủ — mẹ đang cho bú cần thêm khoảng 400-500 calo/ngày so với bình thường.',
      'Nếu bị tắc tia sữa, chườm ấm và massage trước khi vắt, cho bé bú cạn bên đó trước.'
    ],
    avoidList: [
      'Không dùng thuốc giảm đau hoặc kháng sinh khi chưa hỏi bác sĩ về mức độ an toàn khi cho bú.',
      'Không cai sữa đột ngột vì có thể gây căng sữa, tắc nghẽn và viêm vú.',
      'Tránh stress kéo dài vì ảnh hưởng rõ ràng đến lượng sữa và chất lượng sữa.'
    ],
    reassurance: 'Không có mẹ nào ít sữa mãi mãi — phần lớn vấn đề về sữa đều cải thiện được khi xác định đúng nguyên nhân và áp dụng đúng cách.',
    warningSigns: 'Đến bác sĩ ngay nếu ngực đỏ, sưng nóng, đau dữ dội và sốt vì đây là dấu hiệu viêm vú cần điều trị kháng sinh.'
  });

  if (cat === 'nutrition') return Object.assign({}, base, {
    subject,
    explanation: `Dinh dưỡng thai kỳ không cần phức tạp — nguyên tắc cơ bản là đa dạng thực phẩm tự nhiên, đủ nhóm chất và không bỏ bữa.`,
    whyReasons: [
      'Nhu cầu vi chất tăng mạnh trong thai kỳ — sắt, canxi, DHA, axit folic và iốt cần đủ để thai nhi phát triển não bộ, xương và các cơ quan.',
      'Cơ thể mẹ ưu tiên cho thai nhi trước — nếu mẹ thiếu dinh dưỡng thì cơ thể lấy từ kho dự trữ của mẹ, làm mẹ yếu dần theo thời gian.',
      'Chất lượng thực phẩm quan trọng hơn số lượng — ăn nhiều thức ăn kém dinh dưỡng vẫn có thể thiếu vi chất trong khi cân nặng tăng thêm.'
    ],
    quickActions: [
      'Đảm bảo mỗi bữa có ít nhất: một nguồn đạm, một nguồn tinh bột phức và hai màu rau củ khác nhau.',
      'Dùng viên bổ sung prenatal đúng chỉ dẫn để bổ sung các vi chất khó đủ từ thực phẩm đơn thuần.',
      'Ăn bữa phụ giàu canxi: sữa tươi, sữa chua, đậu phụ hoặc các loại rau xanh đậm.'
    ],
    recommendations: [
      'Cá hồi, cá thu, trứng và hạt lanh là nguồn DHA tốt — ăn 2-3 lần/tuần để hỗ trợ não bộ bé.',
      'Ăn kèm vitamin C khi bổ sung sắt để tăng hấp thu lên gấp đôi.',
      'Hạn chế cá có hàm lượng thủy ngân cao như cá kiếm, cá ngừ vây xanh trong suốt thai kỳ.'
    ],
    avoidList: [
      'Tránh thực phẩm sống hoặc chưa nấu chín kỹ như sushi, gỏi, trứng lòng đào.',
      'Hạn chế caffeine dưới 200mg/ngày — tương đương khoảng 1 ly cà phê nhỏ.',
      'Không uống rượu ở bất kỳ liều lượng nào vì không có ngưỡng an toàn trong thai kỳ.'
    ],
    reassurance: 'Không cần ăn hoàn hảo mỗi ngày — chỉ cần đủ đa dạng và đều đặn, bé sẽ nhận được những gì cần thiết.',
    warningSigns: 'Nếu sụt cân, da xanh xao, mệt mỏi liên tục hoặc móng tay giòn gãy nhiều, hãy xét nghiệm để kiểm tra thiếu sắt và các vi chất.'
  });

  if (cat === 'exercise') return Object.assign({}, base, {
    subject,
    explanation: `Vận động đúng cách trong thai kỳ mang lại lợi ích rõ ràng cho cả mẹ lẫn bé — nhưng quan trọng là chọn đúng bài và đúng cường độ.`,
    whyReasons: [
      'Vận động kích thích lưu thông máu, giúp dưỡng chất đến nhau thai hiệu quả hơn và giảm nguy cơ tiểu đường thai kỳ.',
      'Cơ sàn chậu và cơ lõi khỏe hơn nhờ tập đúng cách giúp chuyển dạ tự nhiên dễ hơn và phục hồi sau sinh nhanh hơn.',
      'Hormone endorphin tiết ra khi tập thể dục cải thiện tâm trạng và giảm lo âu hiệu quả không kém thuốc trong nhiều nghiên cứu.'
    ],
    quickActions: [
      'Bắt đầu với 20-30 phút đi bộ nhẹ mỗi ngày — đây là bài tập an toàn và hiệu quả nhất trong toàn bộ thai kỳ.',
      'Bài tập Kegel đơn giản: siết cơ vùng chậu 5 giây, thả 5 giây, 20 lần mỗi ngày — làm được ở bất cứ đâu.',
      'Tập yoga cho bà bầu với giáo viên có chứng chỉ để học các tư thế an toàn và điều chỉnh hơi thở.'
    ],
    recommendations: [
      'Tập ở cường độ vừa phải — có thể nói chuyện được trong khi tập là đúng cường độ.',
      'Bơi lội là bài tập toàn thân lý tưởng trong thai kỳ vì nước đỡ trọng lượng cơ thể, không gây chấn thương.',
      'Ngừng tập và nghỉ ngay nếu cảm thấy đau, chóng mặt, khó thở hoặc tim đập quá nhanh.'
    ],
    avoidList: [
      'Tránh các môn có nguy cơ té ngã hoặc va chạm như bóng đá, cầu lông, cưỡi ngựa.',
      'Không tập nằm ngửa sau tuần 20 vì tử cung lớn chèn ép tĩnh mạch chủ dưới gây giảm máu về tim.',
      'Không tập trong thời tiết nóng hoặc ở nơi độ ẩm cao vì nguy cơ tăng thân nhiệt.'
    ],
    reassurance: 'Mẹ bầu tập thể dục đều đặn thường có ca sinh ngắn hơn, đau ít hơn và phục hồi nhanh hơn — đây là đầu tư xứng đáng.',
    warningSigns: 'Dừng tập và đến bệnh viện nếu đau bụng, ra máu, dịch ối, đau ngực hoặc khó thở bất thường trong hoặc sau khi tập.'
  });

  if (cat === 'postpartum_recovery') return Object.assign({}, base, {
    subject,
    explanation: `Phục hồi sau sinh là quá trình cần thời gian thực sự — cơ thể mẹ đã trải qua thay đổi lớn trong 9 tháng và không thể trở về trạng thái cũ chỉ trong vài tuần.`,
    whyReasons: [
      'Hormone estrogen và progesterone giảm đột ngột sau sinh gây ra loạt thay đổi: tiết mồ hôi nhiều, tóc rụng, da khô, cảm xúc thất thường trong 3-6 tháng đầu.',
      'Cơ sàn chậu, cơ bụng và khớp xương chậu bị ảnh hưởng sau sinh — phục hồi chức năng cần được thực hiện đúng cách chứ không chỉ trông chờ thời gian.',
      'Thiếu ngủ mãn tính và nhu cầu cho bú liên tục làm tốc độ phục hồi chậm lại đáng kể nếu mẹ không được nghỉ ngơi đủ.'
    ],
    quickActions: [
      'Ưu tiên ngủ khi bé ngủ ở những tuần đầu — căn nhà có thể lộn xộn tạm thời nhưng sức khỏe mẹ không thể bỏ lơ.',
      'Bắt đầu bài Kegel nhẹ từ ngày thứ 2-3 sau sinh thường hoặc 4-6 tuần sau mổ để phục hồi cơ sàn chậu sớm.',
      'Ăn đủ — sau sinh mẹ cần nhiều calo hơn bình thường vì vừa hồi phục vừa sản xuất sữa.'
    ],
    recommendations: [
      'Gặp chuyên gia vật lý trị liệu sàn chậu sau 6-8 tuần sinh để đánh giá và phục hồi cơ đúng cách.',
      'Trước khi thực hiện bài tập bụng cần kiểm tra tách cơ thẳng bụng — tự tập sai có thể làm tình trạng tệ hơn.',
      'Massage sẹo mổ (nếu có) bắt đầu từ 6-8 tuần sau sinh để giảm kết dính mô sẹo.'
    ],
    avoidList: [
      'Không vội tập lại bài tập cường độ cao trước 12 tuần sau sinh vì xương khớp và nội tạng chưa ổn định.',
      'Không tự áp lực giảm cân ngay — cơ thể cần ăn đủ để phục hồi và sản xuất sữa.',
      'Không làm nặng, mang vác nặng trong 6-8 tuần đầu sau sinh mổ.'
    ],
    reassurance: 'Phục hồi hoàn toàn sau sinh thường mất 12-18 tháng — không phải 6 tuần như nhiều người nghĩ. Hãy nhẹ nhàng với bản thân.',
    warningSigns: 'Đi khám ngay nếu đau bụng tăng, sốt trên 38°C, sản dịch có mùi hôi bất thường, vết mổ đỏ tiết mủ hoặc bất kỳ dấu hiệu nhiễm trùng nào.'
  });

  if (cat === 'pain_generic') return Object.assign({}, base, {
    subject,
    explanation: `Cơn ${subject} khi mang thai thường có liên quan đến những thay đổi cơ học, hormone hoặc tuần hoàn mà cơ thể đang trải qua — hiểu rõ giúp xử lý hiệu quả hơn.`,
    whyReasons: [
      `Hormone relaxin và progesterone làm lỏng dây chằng và gân cơ toàn thân, khiến ${subject} xuất hiện dễ hơn khi thay đổi tư thế hoặc vận động.`,
      `Áp lực từ tử cung ngày càng lớn lên các mạch máu, dây thần kinh và cơ xung quanh là nguyên nhân trực tiếp của nhiều loại đau trong thai kỳ.`,
      `Tư thế sai kéo dài, thiếu vận động hoặc vận động quá mức đột ngột đều có thể làm ${subject} nặng hơn.`
    ],
    quickActions: [
      'Nghỉ ngơi ở tư thế thoải mái, thường là nghiêng trái với gối kê giữa hai đầu gối để giảm áp lực.',
      'Chườm ấm vùng đau 15-20 phút nếu không phải vùng bụng — tuyệt đối không chườm bụng.',
      'Thay đổi tư thế chậm rãi, tránh đứng dậy hoặc cúi xuống đột ngột.'
    ],
    recommendations: [
      `Vật lý trị liệu hoặc massage thai kỳ do chuyên gia thực hiện có thể giúp ${subject} cải thiện rõ trong vài buổi.`,
      'Mặc đai hỗ trợ bụng bầu đúng size có thể giảm tải đáng kể cho vùng lưng và hông.',
      'Bổ sung magie, canxi theo chỉ định bác sĩ vì thiếu hai khoáng chất này thường làm đau cơ tăng.'
    ],
    avoidList: [
      'Không tự ý dùng thuốc giảm đau khi chưa hỏi bác sĩ — nhiều loại phổ biến không an toàn trong thai kỳ.',
      'Tránh đứng hoặc ngồi một tư thế quá 45 phút liên tục.',
      'Không bỏ qua cơn đau tăng đột ngột hoặc đau kèm các dấu hiệu bất thường khác.'
    ],
    reassurance: `Phần lớn cơn ${subject} trong thai kỳ là sinh lý bình thường và sẽ cải thiện sau sinh — can thiệp đúng sẽ giúp mẹ dễ chịu hơn rõ rệt ngay cả trước khi sinh.`,
    warningSigns: 'Đến bệnh viện ngay nếu đau dữ dội đột ngột, đau kèm sốt, ra máu hoặc không giảm sau khi nghỉ ngơi và thay đổi tư thế.'
  });

  // cat === 'general_pregnancy' — broad fallback but still mẹ bầu-focused
  return Object.assign({}, base, {
    subject,
    explanation: `Đây là chủ đề nhiều mẹ bầu và mẹ sau sinh quan tâm — và câu trả lời đúng luôn bắt đầu từ việc hiểu cơ thể mình đang thay đổi như thế nào.`,
    whyReasons: [
      `${subject} thường liên quan đến những biến đổi hormone, sinh lý và tâm lý diễn ra song song trong suốt thai kỳ và giai đoạn sau sinh.`,
      'Cơ thể mỗi mẹ phản ứng khác nhau với thai kỳ — không phải mọi thứ giống sách hay giống người khác đều là bình thường hoặc bất thường.',
      'Nhiều vấn đề mẹ bầu gặp phải có giải pháp đơn giản khi biết đúng nguyên nhân, nhưng dễ bị bỏ qua vì thiếu thông tin cụ thể.'
    ],
    quickActions: [
      'Ghi chép lại triệu chứng cụ thể: khi nào, tần suất bao lâu, kèm điều gì — thông tin này rất có giá trị khi gặp bác sĩ.',
      'Uống đủ nước và ăn đủ bữa là nền tảng cơ bản giúp cơ thể xử lý hầu hết vấn đề nhỏ trong thai kỳ.',
      'Nghỉ ngơi đủ giấc và giảm nguồn gây stress là bước đầu tiên trước khi tìm giải pháp phức tạp hơn.'
    ],
    recommendations: [
      'Khám thai định kỳ đúng lịch là cách tốt nhất để theo dõi sức khỏe mẹ và bé một cách toàn diện.',
      'Tham gia cộng đồng mẹ bầu uy tín để chia sẻ kinh nghiệm thực tế, nhưng luôn kiểm chứng với bác sĩ trước khi áp dụng.',
      `Đọc thêm thông tin về ${subject} từ nguồn y khoa uy tín để có đủ kiến thức trao đổi với bác sĩ.'`
    ],
    avoidList: [
      'Tránh tự chẩn đoán và tự điều trị dựa trên thông tin mạng xã hội không được kiểm chứng.',
      'Không bỏ qua bất kỳ dấu hiệu bất thường nào — báo bác sĩ sớm hơn bao giờ cũng tốt hơn.',
      'Tránh stress vì lo lắng quá mức — nhiều thứ tự giải quyết được khi cơ thể được nghỉ ngơi đủ.'
    ],
    reassurance: 'Mẹ không cần biết tất cả ngay một lúc — học từng bước, hỏi khi không chắc và tin tưởng bản năng của chính mình.',
    warningSigns: 'Luôn đến bệnh viện nếu có bất kỳ điều gì khiến mẹ lo lắng — không có câu hỏi nào là thừa khi liên quan đến sức khỏe mẹ và bé.'
  });
}

function durationSegments(duration) {
  if (duration >= 140) {
    return { hook: '0-5s', intro: '5-18s', body1: '18-46s', body2: '46-76s', body3: '76-112s', warning: '112-128s' };
  }

  if (duration >= 110) {
    return { hook: '0-4s', intro: '4-14s', body1: '14-36s', body2: '36-62s', body3: '62-94s', warning: '94-108s' };
  }

  return { hook: '0-4s', intro: '4-12s', body1: '12-30s', body2: '30-52s', body3: '52-76s', warning: '76-88s' };
}

function buildFallbackScript({ titleText, topicText, toneText, duration }) {
  const { min, max } = estimateWordTarget(duration);
  const style = toneProfile(toneText);
  const safetyLine = 'Lưu ý an toàn: dừng ngay nếu có đau tăng, choáng hoặc khó chịu bất thường và tham khảo nhân viên y tế khi cần.';

  const intent = detectIntent(topicText);
  const knowledge = getTopicKnowledge(topicText);
  const segments = durationSegments(duration);

  if (intent === 'list') {
    const count = extractRequestedCount(topicText, 6);
    const listMode = getListMode(topicText);
    const listPayload = buildListItems(topicText, knowledge, count);
    const listItems = listPayload.items || [];
    const introByTone = {
      'chuyên gia': `Trả lời thẳng: đây là ${listItems.length} gợi ý đúng chủ đề ${normalizeSubject(topicText)} để mẹ áp dụng ngay.`,
      'truyền cảm hứng': `Đây là ${listItems.length} gợi ý dễ làm để mẹ đỡ rối và bắt đầu ngay hôm nay.`,
      'thực tế, đi thẳng vấn đề': `Không lan man, đây là ${listItems.length} gợi ý cụ thể cho ${normalizeSubject(topicText)}.`,
      'thân thiện': `Mình gửi mẹ ${listItems.length} gợi ý cụ thể cho ${normalizeSubject(topicText)} nhé.`
    };

    const modeIntroOverride = {
      foods: `Với chủ đề ${normalizeSubject(topicText)}, mẹ nên ưu tiên bữa cân bằng thay vì chỉ dựa vào một món đơn lẻ.`,
      warnings: 'Đây là các dấu hiệu cảnh báo thường gặp, có dấu hiệu nào rõ thì nên đi khám sớm.',
      exercises: 'Ưu tiên bài tập nhẹ, đúng kỹ thuật và dừng ngay nếu cơ thể khó chịu bất thường.'
    };
    const modeReassurance = {
      foods: 'Ăn uống đều và cân bằng trong nhiều ngày sẽ hiệu quả hơn chạy theo một món hoặc một mẹo đơn lẻ.',
      warnings: 'Không cần hoảng sợ, nhưng đừng trì hoãn khi có dấu hiệu rõ vì đi khám sớm luôn an toàn hơn.',
      exercises: 'Bài tập an toàn là bài tập mẹ làm đúng kỹ thuật, vừa sức và duy trì đều mỗi ngày.'
    };
    const modeWarning = {
      foods: knowledge.warningSigns,
      warnings: 'Nếu xuất hiện một trong các dấu hiệu trên ở mức rõ hoặc tăng dần, nên đi khám ngay thay vì tự theo dõi kéo dài.',
      exercises: 'Nếu đau bụng, choáng, ra huyết, khó thở hoặc khó chịu tăng khi tập, dừng tập ngay và liên hệ cơ sở y tế.'
    };

    const lines = listItems.map((item, index) => `${index + 1}. ${item.name}: ${item.why}`);
    return [
      `Hook (${segments.hook}): "${introByTone[style.name] || introByTone['thân thiện']}"`,
      '',
      `Trả lời ngắn (${segments.intro}): ${modeIntroOverride[listMode] || knowledge.explanation}`,
      '',
      listPayload.heading || 'Danh sách gợi ý:',
      ...lines,
      '',
      `Chốt lại: ${modeReassurance[listMode] || knowledge.reassurance}`,
      '',
      `Lưu ý (${segments.warning}): ${modeWarning[listMode] || knowledge.warningSigns} ${safetyLine}`,
      '',
      `CTA (cuối video): "${pickOne(knowledge.ctas)}"`,
      '',
      `Mục tiêu từ: ${min}-${max} từ.`
    ].join('\n');
  }

  if (intent === 'why' || intent === 'warning') {
    const hookByTone = {
      'chuyên gia': [
        `Nói ngắn gọn: ${knowledge.subject} không phải chuyện ngẫu nhiên, và đây là 3 lý do xảy ra nhiều nhất.`,
        `Nếu đang thắc mắc ${topicText.toLowerCase()}, câu trả lời nằm ở 3 thay đổi rất điển hình của cơ thể.`
      ],
      'truyền cảm hứng': [
        `Nhiều mẹ nghĩ mình chịu đau là bình thường, nhưng hiểu đúng ${knowledge.subject} sẽ giúp mẹ nhẹ người hơn nhiều.`,
        'Khi biết vì sao cơ thể mình như vậy, mẹ sẽ bớt hoang mang hơn rất nhiều.'
      ],
      'thực tế, đi thẳng vấn đề': [
        `${sentenceCase(knowledge.subject)} thường đến từ 3 nguyên nhân chính. Biết đúng nguyên nhân thì mới xử lý đúng.`,
        `Đừng đoán mò ${topicText.toLowerCase()}; đây là 3 lý do xảy ra thường gặp nhất.`
      ],
      'thân thiện': [
        `Nếu bạn đang thắc mắc ${topicText.toLowerCase()}, mình giải thích ngắn gọn để mẹ hiểu ngay.`,
        'Mẹ bầu đau chỗ này không hẳn là bất thường, nhưng cần hiểu đúng nguyên nhân để bớt lo.'
      ]
    };

    const orderedReasons = shuffle(knowledge.whyReasons).slice(0, 3);
    return [
      `Hook (${segments.hook}): "${pickOne(hookByTone[style.name] || hookByTone['thân thiện'])}"`,
      '',
      `Trả lời ngắn: ${knowledge.explanation}`,
      '',
      `Giải thích nhanh (${segments.intro}): ${knowledge.explanation}`,
      '',
      `Lý do 1 (${segments.body1}): ${orderedReasons[0]}`,
      '',
      `Lý do 2 (${segments.body2}): ${orderedReasons[1]}`,
      '',
      `Lý do 3 (${segments.body3}): ${orderedReasons[2]}`,
      '',
      `Chốt lại: ${knowledge.reassurance}`,
      '',
      duration >= 110
        ? `Mẹo áp dụng ngay: ${shuffle(knowledge.quickActions).slice(0, 2).join(' ')}`
        : `Mẹo áp dụng ngay: ${pickOne(knowledge.quickActions)}`,
      '',
      `Khi nào cần đi khám (${segments.warning}): ${knowledge.warningSigns} ${safetyLine}`,
      '',
      `CTA (cuối video): "${pickOne(knowledge.ctas)}"`,
      '',
      `Mục tiêu từ: ${min}-${max} từ.`
    ].join('\n');
  }

  if (intent === 'recommend') {
    const recommendHooks = {
      'chuyên gia': [
        `Trả lời thẳng câu hỏi ${normalizeSubject(topicText)}: mẹ ưu tiên tiêu chí đúng trước, rồi mới chọn sản phẩm/thực đơn cụ thể.`,
        `Để chọn đúng cho ${knowledge.subject}, mẹ bám 3 tiêu chí cốt lõi dưới đây.`
      ],
      'truyền cảm hứng': [
        'Mẹ không cần theo mọi gợi ý trên mạng, chỉ cần chọn đúng vài điểm quan trọng là đã khác rất nhiều.',
        `Mình trả lời ngắn gọn cho ${normalizeSubject(topicText)} để mẹ áp dụng ngay hôm nay.`
      ],
      'thực tế, đi thẳng vấn đề': [
        `Không lan man, đây là câu trả lời trực tiếp cho ${normalizeSubject(topicText)}.`,
        `Muốn kết quả ổn, mẹ bám đúng 3 gợi ý dưới đây.`
      ],
      'thân thiện': [
        `Mình trả lời thẳng cho câu hỏi ${normalizeSubject(topicText)} nhé, mẹ làm theo từng bước là ổn.`,
        `Nếu đang phân vân ${normalizeSubject(topicText)}, đây là cách chọn dễ áp dụng nhất.`
      ]
    };

    const picks = shuffle(knowledge.recommendations).slice(0, 3);
    const avoids = shuffle(knowledge.avoidList).slice(0, 2);
    return [
      `Hook (${segments.hook}): "${pickOne(recommendHooks[style.name] || recommendHooks['thân thiện'])}"`,
      '',
      `Trả lời ngắn (${segments.intro}): ${knowledge.explanation}`,
      '',
      `Gợi ý 1 (${segments.body1}): ${picks[0]}`,
      '',
      `Gợi ý 2 (${segments.body2}): ${picks[1]}`,
      '',
      `Gợi ý 3 (${segments.body3}): ${picks[2]}`,
      '',
      `Cần tránh: ${avoids.join(' ')}`,
      '',
      `Chốt lại: ${knowledge.reassurance}`,
      '',
      `Lưu ý (${segments.warning}): ${knowledge.warningSigns} ${safetyLine}`,
      '',
      `CTA (cuối video): "${pickOne(knowledge.ctas)}"`,
      '',
      `Mục tiêu từ: ${min}-${max} từ.`
    ].join('\n');
  }

  const actionByTone = {
    'chuyên gia': {
      hook: [
        `Nếu đang xử lý ${knowledge.subject}, hãy bám đúng 3 bước dưới đây để đỡ làm sai ngay từ đầu.`,
        `Muốn cải thiện ${knowledge.subject} rõ hơn, đừng làm theo cảm giác; đi theo quy trình này.`
      ],
      intro: [
        'Nguyên tắc là làm đúng thứ tự: hiểu nguyên nhân, chọn một thay đổi chính, rồi theo dõi phản hồi cơ thể.',
        'Làm ít nhưng đúng sẽ hiệu quả hơn làm nhiều mà không quan sát phản ứng của cơ thể.'
      ]
    },
    'truyền cảm hứng': {
      hook: [
        `Bạn không cần làm hoàn hảo để cải thiện ${knowledge.subject}; chỉ cần bắt đầu bằng một bước đủ nhẹ hôm nay.`,
        `Cơ thể mẹ không cần thêm áp lực, mẹ chỉ cần một lộ trình nhẹ nhàng nhưng đều.`
      ],
      intro: [
        'Một thay đổi nhỏ lặp lại mỗi ngày thường giúp cơ thể dễ chịu hơn nhiều so với cố quá trong một lần.',
        'Mình sẽ đi theo cách vừa sức để mẹ dễ duy trì mà không thấy nặng nề.'
      ]
    },
    'thực tế, đi thẳng vấn đề': {
      hook: [
        `Muốn xử lý ${knowledge.subject}, làm đúng 3 việc sau.`,
        `Không nói dài: đây là 3 việc mẹ nên làm trước nếu đang gặp ${knowledge.subject}.`
      ],
      intro: [
        'Bỏ qua các mẹo lan man. Chỉ giữ lại thứ dễ làm và có thể theo dõi được.',
        'Đừng thay 5 thứ một lúc, vì như vậy sẽ không biết cái gì thực sự hiệu quả.'
      ]
    },
    'thân thiện': {
      hook: [
        `Nếu mẹ chưa biết bắt đầu với ${knowledge.subject} từ đâu, mình gợi ý 3 bước dễ áp dụng trước nhé.`,
        `Mình không cần làm quá nhiều, chỉ cần đi đúng 3 bước cơ bản là đã khác rồi.`
      ],
      intro: [
        'Mục tiêu của mình là giúp cơ thể đỡ khó chịu hơn từng chút một, chứ không ép bản thân làm quá sức.',
        'Cứ làm từng bước nhỏ, theo dõi phản ứng của cơ thể rồi điều chỉnh dần.'
      ]
    }
  };

  const toneActions = actionByTone[style.name] || actionByTone['thân thiện'];
  const orderedActions = shuffle(knowledge.quickActions).slice(0, 3);
  const extraSpokenLine = {
    'chuyên gia': `Mẹ nhớ điểm này: ${knowledge.reassurance}`,
    'truyền cảm hứng': `Nhớ nhé, ${knowledge.reassurance.toLowerCase()}`,
    'thực tế, đi thẳng vấn đề': `Chốt nhanh: ${knowledge.reassurance}`,
    'thân thiện': `Điều mình muốn mẹ nhớ là: ${knowledge.reassurance}`
  };
  const longerDetail = duration >= 110
    ? `Nói thêm một chút: ${shuffle(knowledge.quickActions).slice(0, 2).join(' ')}`
    : null;
  return [
    `Hook (${segments.hook}): "${pickOne(toneActions.hook)}"`,
    '',
    `Trả lời nhanh cho câu hỏi ${normalizeSubject(topicText)}: bắt đầu từ 3 bước dễ làm dưới đây để đi đúng trọng tâm.`,
    '',
    `Mở đầu (${segments.intro}): ${pickOne(toneActions.intro)}`,
    '',
    `Bước 1 (${segments.body1}): ${orderedActions[0]}`,
    '',
    `Bước 2 (${segments.body2}): ${orderedActions[1]}`,
    '',
    `Bước 3 (${segments.body3}): ${orderedActions[2]}`,
    '',
    extraSpokenLine[style.name] || extraSpokenLine['thân thiện'],
    '',
    longerDetail,
    longerDetail ? '' : null,
    `Lưu ý (${segments.warning}): ${knowledge.warningSigns} ${safetyLine}`,
    '',
    `CTA (cuối video): "${pickOne(knowledge.ctas)}"`,
    '',
    `Mục tiêu từ: ${min}-${max} từ.`
  ].filter(Boolean).join('\n');
}

function finalizeOutput(parsed, defaults) {
  if (!parsed) {
    return {
      title: defaults.title,
      caption: defaults.caption,
      hashtags: defaults.hashtags,
      script: defaults.fallbackScript,
      voiceOff: defaults.fallbackScript,
      providerUsed: defaults.providerUsed
    };
  }

  const script = parsed.script || parsed.voiceOff;
  const voiceOff = parsed.voiceOff || parsed.script;
  if (!script || !voiceOff) {
    return {
      title: defaults.title,
      caption: defaults.caption,
      hashtags: defaults.hashtags,
      script: defaults.fallbackScript,
      voiceOff: defaults.fallbackScript,
      providerUsed: defaults.providerUsed
    };
  }

  return {
    title: parsed.title || defaults.title,
    caption: parsed.caption || defaults.caption,
    hashtags: safeArray(parsed.hashtags, defaults.hashtags),
    script,
    voiceOff,
    providerUsed: defaults.providerUsed
  };
}

async function generateScriptFromIdea(idea, tone = 'thân thiện', duration = 90, provider = 'auto') {
  const safeDuration = clampDuration(duration);
  const maxTokens = estimateMaxTokens(safeDuration);
  const titleText = idea?.title?.trim() || 'Ý tưởng video cho mẹ bầu';
  const topicText = inferFocusTopic(titleText, idea?.topic?.trim() || titleText);
  const toneText = tone?.trim() || 'thân thiện';
  const providerMode = normalizeProvider(provider);

  const title = `Kịch bản video TikTok: ${titleText}`;
  const caption = `Nội dung trọng tâm về ${topicText}, dễ ứng dụng cho mẹ bầu và sau sinh.`;
  const hashtags = ['#mebau', '#sausinh', '#contentcreator', `#video${safeDuration}s`];
  const fallbackScript = buildFallbackScript({
    titleText,
    topicText,
    toneText,
    duration: safeDuration
  });
  const prompt = buildPrompt({ titleText, topicText, duration: safeDuration, toneText });

  const runOpenAI = providerMode === 'openai' || providerMode === 'auto';
  const runGemini = providerMode === 'gemini' || providerMode === 'auto';

  if (runOpenAI) {
    const result = await generateWithOpenAI(prompt, maxTokens);
    if (result.ok) {
      const parsed = parseJsonFromText(result.text);
      return finalizeOutput(parsed, {
        title,
        caption,
        hashtags,
        fallbackScript,
        providerUsed: 'openai'
      });
    }
    console.warn(result.reason);
  }

  if (runGemini) {
    const result = await generateWithGemini(prompt, maxTokens);
    if (result.ok) {
      const parsed = parseJsonFromText(result.text);
      return finalizeOutput(parsed, {
        title,
        caption,
        hashtags,
        fallbackScript,
        providerUsed: 'gemini'
      });
    }
    console.warn(result.reason);
  }

  return {
    title,
    caption,
    hashtags,
    script: fallbackScript,
    voiceOff: fallbackScript,
    providerUsed: 'fallback'
  };
}

module.exports = { generateScriptFromIdea };
