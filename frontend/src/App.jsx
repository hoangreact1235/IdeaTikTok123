import { useState } from 'react';
import IdeaCollector from './components/IdeaCollector.jsx';
import ScriptGenerator from './components/ScriptGenerator.jsx';
import ContentCalendar from './components/ContentCalendar.jsx';

function App() {
  const [selectedIdea, setSelectedIdea] = useState(null);

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <p className="eyebrow">Content Creator Toolkit</p>
          <h1>TikTok Idea & Content Manager</h1>
          <p className="hero-text">Thu thập ý tưởng, tạo kịch bản và quản lý lịch đăng cho mẹ bầu & sau sinh với giao diện chuyên nghiệp.</p>
        </div>
      </header>

      <main>
        <div className="grid">
          <IdeaCollector selectedIdea={selectedIdea} onSelectIdea={setSelectedIdea} />
          <ScriptGenerator idea={selectedIdea} />
        </div>
        <ContentCalendar />
      </main>
    </div>
  );
}

export default App;
