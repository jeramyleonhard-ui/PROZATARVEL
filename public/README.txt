Travel Together — Tak RGB Edition

ไฟล์:
- index.html
- style.css
- index.js

วิธีใช้:
1. วางทั้ง 3 ไฟล์ไว้ในโฟลเดอร์เดียวกัน
2. ให้เว็บเซิร์ฟเวอร์เสิร์ฟไฟล์หน้าเว็บที่ root path เพื่อให้ /style.css และ /index.js ใช้งานได้
3. ระบบสถานที่ สมาชิก และเรื่องเล่ายังต้องมี backend API ตามเดิม:
   GET /api/places
   GET /api/auth/me
   POST /api/auth/login
   POST /api/auth/register
   POST /api/auth/logout
   GET /api/posts
   POST /api/posts
   DELETE /api/posts/:id

ภาพ:
- หน้าเว็บจะใช้ imageUrl/image/photo/cover ที่ส่งมาจาก /api/places หากมี
- ถ้า API ไม่มี URL ภาพ จะเลือกภาพประกอบตามชื่อ/ประเภทสถานที่จาก Unsplash
- ภาพ fallback เป็นภาพประกอบตามหมวด ไม่รับประกันว่าเป็นภาพถ่ายตรงของสถานที่นั้นทุกใบ
