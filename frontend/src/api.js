const API_BASE = '/api';

export async function searchIdeas(query, platform = 'all') {
  const response = await fetch(`${API_BASE}/ideas/search?query=${encodeURIComponent(query)}&platform=${encodeURIComponent(platform)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Không thể tìm ý tưởng.');
  }
  return data;
}

export async function generateScript(idea, duration = 90, tone = 'thân thiện', provider = 'gemini') {
  const response = await fetch(`${API_BASE}/scripts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, duration, tone, provider })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Không thể tạo kịch bản.');
  }
  return data;
}

export async function loadSchedule() {
  const response = await fetch(`${API_BASE}/schedule`);
  return response.json();
}

export async function saveSchedule(item) {
  const response = await fetch(`${API_BASE}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  return response.json();
}
