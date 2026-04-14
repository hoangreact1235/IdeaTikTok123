import { useEffect, useState } from 'react';
import { loadSchedule, saveSchedule } from '../api.js';

function ContentCalendar() {
  const [schedule, setSchedule] = useState([]);
  const [form, setForm] = useState({ date: '', time: '', title: '' });

  useEffect(() => {
    async function fetch() {
      const items = await loadSchedule();
      setSchedule(items);
    }
    fetch();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    const newItem = await saveSchedule(form);
    setSchedule((prev) => [...prev, newItem]);
    setForm({ date: '', time: '', title: '' });
  }

  return (
    <section className="panel calendar-panel">
      <h2>Lịch đăng</h2>
      <form className="schedule-form" onSubmit={handleSave}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
        <input placeholder="Tiêu đề nội dung" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <button type="submit">Lưu lịch</button>
      </form>
      {schedule.length === 0 ? (
        <p className="hint-text">Chưa có nội dung nào trong lịch. Thêm lịch đăng để quản lý dễ hơn.</p>
      ) : (
        <ul className="schedule-list">
          {schedule.map((item) => (
            <li key={item.id}>
              <strong>{item.date} {item.time}</strong>
              <p>{item.title} — {item.status || 'Chờ đăng'}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ContentCalendar;
