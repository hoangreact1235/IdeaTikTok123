import { useEffect, useState } from 'react';
import { generateScript } from '../api.js';

function ScriptGenerator({ idea }) {
  const [script, setScript] = useState(null);
  const [duration, setDuration] = useState(90);
  const [tone, setTone] = useState('thân thiện');
  const [provider, setProvider] = useState('gemini');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setScript(null);
    setError('');
  }, [idea]);

  async function handleGenerate() {
    if (!idea) return;
    setLoading(true);
    setError('');
    try {
      const result = await generateScript(idea, duration, tone, provider);
      setScript(result);
    } catch (err) {
      setError(err.message);
      setScript(null);
    }
    setLoading(false);
  }

  return (
    <section className="panel">
      <h2>Tạo kịch bản</h2>
      <div className="selected-idea">
        <p>{idea ? `Đang tạo kịch bản cho: ${idea.title}` : 'Chọn một ý tưởng bên trái.'}</p>
      </div>
      <div className="script-controls">
        <label>
          Độ dài video (giây):
          <input
            type="number"
            min="60"
            max="180"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label>
          Tone nội dung:
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="thân thiện">Thân thiện</option>
            <option value="chuyên gia">Chuyên gia</option>
            <option value="truyền cảm hứng">Truyền cảm hứng</option>
            <option value="thực tế, đi thẳng vấn đề">Thực tế, đi thẳng vấn đề</option>
          </select>
        </label>
        <label>
          AI Provider:
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="gemini">Gemini</option>
            <option value="fallback">Miễn phí</option>
          </select>
        </label>
      </div>
      <button onClick={handleGenerate} disabled={!idea || loading}>
        {loading ? 'Đang tạo...' : 'Sinh kịch bản voice-off'}
      </button>
      {error && <p className="hint-text error-text">{error}</p>}
      {script && (
        <div className="script-output">
          <h3>{script.title}</h3>
          <p><strong>Provider:</strong> {script.providerUsed || 'unknown'}</p>
          <p><strong>Caption:</strong> {script.caption}</p>
          <p><strong>Hashtags:</strong> {script.hashtags.join(' ')}</p>
          <div>
            <p><strong>Voice-off:</strong></p>
            <pre>{script.voiceOff}</pre>
          </div>
          <div>
            <p><strong>Nội dung kịch bản:</strong></p>
            <pre>{script.script}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

export default ScriptGenerator;
