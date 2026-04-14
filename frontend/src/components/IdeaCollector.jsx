import { useEffect, useState } from 'react';
import { searchIdeas } from '../api.js';

function IdeaCollector({ selectedIdea, onSelectIdea }) {
  const [query, setQuery] = useState('mẹ bầu');
  const [platform, setPlatform] = useState('all');
  const [ideas, setIdeas] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, [platform]);

  async function fetchIdeas() {
    if (!query.trim()) { setIdeas([]); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const result = await searchIdeas(query, platform);
      setIdeas(result.ideas || []);
      if (result.errors?.length) setError(result.errors.join(' '));
    } catch (err) {
      setError(err.message);
      setIdeas([]);
    }
    setLoading(false);
  }

  return (
    <section className="panel">
      <h2>Thu thập ý tưởng</h2>
      <div className="search-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Từ khóa tìm ý tưởng"
          onKeyDown={(e) => e.key === 'Enter' && fetchIdeas()}
        />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">Tất cả nguồn</option>
          <option value="tiktok">TikTok</option>
          <option value="douyin">Douyin</option>
          <option value="youtube shorts">YouTube Shorts</option>
          <option value="instagram reels">Instagram Reels</option>
        </select>
        <button onClick={fetchIdeas} disabled={!query.trim() || loading}>
          {loading ? 'Đang tìm...' : 'Tìm'}
        </button>
      </div>
      {loading ? (
        <p className="hint-text">Đang tìm ý tưởng theo từ khóa...</p>
      ) : error ? (
        <p className="hint-text error-text">{error}</p>
      ) : ideas.length === 0 ? (
        <p className="hint-text">Không tìm thấy ý tưởng. Thử từ khóa khác hoặc thay đổi nguồn.</p>
      ) : (
        <ul className="idea-list">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              onClick={() => onSelectIdea(idea)}
              className={selectedIdea?.id === idea.id ? 'selected' : ''}
            >
              <div className="idea-title-row">
                <strong>{idea.title}</strong>
                <span className="idea-source">{idea.source}</span>
              </div>
              <p className="idea-meta">{idea.topic}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default IdeaCollector;

  useEffect(() => {
    if (tab === 'search') fetchIdeas();
  }, [platform]);

  async function fetchIdeas() {
    if (!query.trim()) { setIdeas([]); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const result = await searchIdeas(query, platform);
      setIdeas(result.ideas || []);
      if (result.errors?.length) setError(result.errors.join(' '));
    } catch (err) {
      setError(err.message);
      setIdeas([]);
    }
    setLoading(false);
  }

  function addManualIdea() {
    if (!manualTitle.trim()) return;
    const idea = {
      id: 'manual-' + Date.now(),
      title: manualTitle.trim(),
      topic: manualTopic.trim() || manualTitle.trim(),
      source: 'Nhập tay',
    };
    setManualIdeas((prev) => [idea, ...prev]);
    setManualTitle('');
    setManualTopic('');
  }

  function removeManualIdea(id) {
    setManualIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  const displayIdeas = tab === 'search' ? ideas : manualIdeas;

  return (
    <section className="panel">
      <h2>Thu thập ý tưởng</h2>

      <div className="tab-row">
        <button
          className={tab === 'search' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('search')}
        >Tìm kiếm</button>
        <button
          className={tab === 'manual' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setTab('manual')}
        >Nhập tay</button>
      </div>

      {tab === 'search' && (
        <div className="search-row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Từ khóa tìm ý tưởng"
            onKeyDown={(e) => e.key === 'Enter' && fetchIdeas()} />
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">Tất cả nguồn</option>
            <option value="tiktok">TikTok</option>
            <option value="douyin">Douyin</option>
            <option value="youtube shorts">YouTube Shorts</option>
            <option value="instagram reels">Instagram Reels</option>
          </select>
          <button onClick={fetchIdeas} disabled={!query.trim() || loading}>
            {loading ? 'Đang tìm...' : 'Tìm'}
          </button>
        </div>
      )}

      {tab === 'manual' && (
        <div className="manual-input-area">
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Tiêu đề ý tưởng (bắt buộc)"
            onKeyDown={(e) => e.key === 'Enter' && addManualIdea()}
          />
          <input
            value={manualTopic}
            onChange={(e) => setManualTopic(e.target.value)}
            placeholder="Chủ đề chi tiết (tuỳ chọn)"
            onKeyDown={(e) => e.key === 'Enter' && addManualIdea()}
          />
          <button onClick={addManualIdea} disabled={!manualTitle.trim()}>+ Thêm</button>
        </div>
      )}

      {tab === 'search' && loading && <p className="hint-text">Đang tìm ý tưởng...</p>}
      {tab === 'search' && !loading && error && <p className="hint-text error-text">{error}</p>}
      {tab === 'search' && !loading && !error && ideas.length === 0 && (
        <p className="hint-text">Không tìm thấy ý tưởng. Thử từ khóa khác hoặc dùng tab Nhập tay.</p>
      )}
      {tab === 'manual' && manualIdeas.length === 0 && (
        <p className="hint-text">Nhập tiêu đề và bấm Thêm để tạo ý tưởng.</p>
      )}

      {displayIdeas.length > 0 && (
        <ul className="idea-list">
          {displayIdeas.map((idea) => (
            <li
              key={idea.id}
              onClick={() => onSelectIdea(idea)}
              className={selectedIdea?.id === idea.id ? 'selected' : ''}
            >
              <div className="idea-title-row">
                <strong>{idea.title}</strong>
                <span className="idea-source">{idea.source}</span>
              </div>
              <p className="idea-meta">{idea.topic}</p>
              {tab === 'manual' && (
                <button
                  className="remove-btn"
                  onClick={(e) => { e.stopPropagation(); removeManualIdea(idea.id); }}
                >✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default IdeaCollector;
