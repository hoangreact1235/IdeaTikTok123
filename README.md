# TikTok / Douyin Content Manager cho Mẹ Bầu & Sau Sinh

Công cụ tạo nội dung TikTok/Douyin chuyên biệt cho creators Việt Nam trong mảng **mẹ bầu và sau sinh**. Tự động gợi ý ý tưởng, tạo kịch bản voice-off chuyên nghiệp và quản lý lịch đăng — hoạt động **không cần API key trả phí**.

## Tính năng

- **Thu thập ý tưởng** — tìm kiếm chủ đề từ YouTube hoặc nhập tay, phân loại theo tag
- **Tạo kịch bản tự động** — sinh kịch bản TikTok 60–150 giây với hook, body, CTA theo tone (thân thiện / chuyên gia / truyền cảm hứng / thực tế)
- **Phân loại chủ đề thông minh** — nhận dạng 15 danh mục: đau đầu, ốm nghén, tiêu hóa, tâm lý, mệt mỏi, tăng cân, da, thai nhi, cho bú, dinh dưỡng, tập thể dục, phục hồi sau sinh…
- **Hoạt động offline** — engine fallback sinh nội dung đúng chủ đề mà không cần OpenAI / Gemini
- **Lịch đăng bài** — lên lịch và quản lý nội dung theo tuần

## Cài đặt & Chạy

### Yêu cầu
- Node.js 18+
- npm

### Backend (port 4000)
```bash
cd backend
npm install
cp .env.example .env   # điền API key nếu muốn dùng YouTube search thật
node src/index.js
```

### Frontend (port 3002)
```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt vào **http://localhost:3002**

## Cấu hình `.env`

Sao chép `backend/.env.example` thành `backend/.env`. Tất cả các key đều tùy chọn — app vẫn chạy đầy đủ tính năng không cần key nào:

| Biến | Mô tả |
|---|---|
| `YOUTUBE_API_KEY` | Tìm kiếm ý tưởng từ YouTube thật (không bắt buộc) |
| `OPENAI_API_KEY` | Dùng GPT để tạo kịch bản (không bắt buộc) |
| `GEMINI_API_KEY` | Dùng Gemini để tạo kịch bản (không bắt buộc) |

## Cấu trúc dự án

```
backend/
  src/
    index.js              # Express server (port 4000)
    routes/
      ideas.js            # GET /api/ideas/search
      scripts.js          # POST /api/scripts/generate
      schedule.js         # GET/POST /api/schedule
    services/
      aiService.js        # Engine tạo kịch bản + fallback thông minh
frontend/
  src/
    components/
      IdeaCollector.jsx   # Thu thập & tìm kiếm ý tưởng
      ScriptGenerator.jsx # Tạo kịch bản voice-off
      ContentCalendar.jsx # Lịch đăng bài
```

## API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/ideas/search?q=...` | Tìm kiếm ý tưởng |
| `POST` | `/api/scripts/generate` | Tạo kịch bản từ idea |
| `GET` | `/api/schedule` | Lấy lịch đăng |
| `POST` | `/api/schedule` | Thêm lịch đăng |

2. OpenAI API
   - Vào https://platform.openai.com/ và đăng nhập.
   - Vào `View API keys` → `Create new secret key`.
   - Copy giá trị và dán vào `backend/.env` mục `OPENAI_API_KEY`.

3. TikTok/Douyin
   - Nếu bạn có endpoint riêng hoặc dịch vụ bên thứ ba hỗ trợ tìm kiếm, nhập URL đó vào `TIKTOK_SEARCH_URL` hoặc `DOUYIN_SEARCH_URL`.
   - Endpoint này cần nhận `query` và trả dữ liệu JSON `{ ideas: [...] }`.

4. Khởi động lại backend
   - `cd d:\AI\backend`
   - `npm run dev`

## Chia sẻ cho người khác dùng
Bạn có 2 cách phổ biến:

1. Dùng chung mạng LAN (nhanh, không public Internet)
    - Chạy backend: `cd backend && npm run dev`
    - Chạy frontend: `cd frontend && npm run dev -- --host`
    - Gửi cho người cùng Wi-Fi địa chỉ dạng `http://<IP-cua-ban>:3002`

2. Deploy public 1 link (khuyên dùng)
    - Bước 1: build frontend
       - `cd frontend`
       - `npm install`
       - `npm run build`
    - Bước 2: chạy backend (backend sẽ tự serve `frontend/dist`)
       - `cd ../backend`
       - `npm install`
       - `npm run start`
    - Sau đó deploy thư mục backend lên Render/Railway/Fly.io.
       - Start command: `npm run start`
       - Environment variables cần set: `YOUTUBE_API_KEY`, `OPENAI_API_KEY`, `TIKTOK_SEARCH_URL`, `DOUYIN_SEARCH_URL`
       - Tùy chọn: `PORT` (nền tảng thường tự cấp)

### Gợi ý nhanh với Render
1. Push code lên GitHub.
2. Vào Render → New Web Service → chọn repo.
3. Root Directory: `backend`
4. Build Command: `npm install && cd ../frontend && npm install && npm run build && cd ../backend`
5. Start Command: `npm run start`
6. Thêm biến môi trường trong Render dashboard.
7. Deploy xong sẽ có 1 URL công khai để gửi cho người khác.
