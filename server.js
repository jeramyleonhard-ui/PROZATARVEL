"use strict";

const express = require("express");
const mariadb = require("mariadb");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { randomBytes, scrypt: scryptCallback, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(scryptCallback);
const envPath = path.join(__dirname, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

function integer(value, fallback, min, max) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error("Invalid numeric configuration");
  return number;
}
const port = integer(process.env.PORT, 31071, 1024, 65535);
const origin = new URL(process.env.APP_ORIGIN || `http://localhost:${port}`).origin;
const secure = origin.startsWith("https://");
const configured = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].every(key => Boolean(process.env[key]));
const pool = configured ? mariadb.createPool({
  host: process.env.DB_HOST,
  port: integer(process.env.DB_PORT, 3306, 1, 65535),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 3,
  connectTimeout: 3000,
  acquireTimeout: 4000,
  queryTimeout: 5000,
  bigIntAsNumber: true,
  dateStrings: true,
  timezone: "+00:00"
}) : null;
const app = express();
const cookieName = secure ? "__Host-tt_session" : "tt_session";
const sessionSeconds = 7 * 24 * 60 * 60;
const hashToken = token => createHash("sha256").update(token).digest("hex");
const places = [
  { id: "thi-lo-su", name: "น้ำตกทีลอซู", district: "อุ้มผาง", category: "น้ำตก", landscape: "waterfall", tag: "สายน้ำกลางผืนป่า", description: "สัมผัสความยิ่งใหญ่ของสายน้ำในเขตรักษาพันธุ์สัตว์ป่าอุ้มผาง ตรวจสอบฤดูกาลเปิดและการเดินทางกับเจ้าหน้าที่ก่อนออกเดินทาง" },
  { id: "doi-soi-malai", name: "ดอยสอยมาลัย", district: "สามเงา", category: "ภูเขา", landscape: "summit", tag: "เส้นทางบนขอบฟ้า", description: "ยอดดอยในอุทยานแห่งชาติดอยสอยมาลัย–ไม้กลายเป็นหิน ชมทะเลหมอกและทิวเขา สอบถามอุทยานเรื่องฤดูเปิด การจอง และรถขึ้นดอยก่อนเดินทาง" },
  { id: "bhumibol-dam", name: "เขื่อนภูมิพล", district: "สามเงา", category: "พักผ่อน", landscape: "lake", tag: "วันช้า ๆ ริมน้ำ", description: "ชมทิวทัศน์อ่างเก็บน้ำและภูเขาที่โอบล้อมเขื่อน เหมาะกับการพักผ่อนและเรียนรู้เรื่องพลังงาน ตรวจสอบกิจกรรมและเวลาเปิดก่อนเดินทาง" },
  { id: "mae-sot", name: "เมืองแม่สอด", district: "แม่สอด", category: "วัฒนธรรม", landscape: "town", tag: "เรื่องเล่าจากเมืองชายแดน", description: "รู้จักเมืองชายแดนผ่านอาหาร ตลาด และความหลากหลายทางวัฒนธรรม เคารพวิถีชีวิตและขออนุญาตก่อนถ่ายภาพบุคคล" },
  { id: "lan-sang", name: "อุทยานแห่งชาติลานสาง", district: "เมืองตาก", category: "น้ำตก", landscape: "forest", tag: "พื้นที่สีเขียวใกล้เมือง", description: "พักใจท่ามกลางป่าและน้ำตกใกล้เมืองตาก เช็กประกาศอุทยาน สภาพอากาศ และข้อจำกัดของเส้นทางในวันที่จะเดินทาง" },
  { id: "ban-tak", name: "วัดพระบรมธาตุบ้านตาก", district: "บ้านตาก", category: "วัฒนธรรม", landscape: "temple", tag: "ร่องรอยแห่งศรัทธา", description: "เยี่ยมชมพระบรมธาตุและเรียนรู้เรื่องราวเมืองตาก แต่งกายสุภาพ รักษาความสงบ และปฏิบัติตามข้อแนะนำของวัด" }
];
// The catalog is editorial content; community posts and accounts are stored in MariaDB.

function fail(status, message) { return Object.assign(new Error(message), { status }); }
function db() { if (!pool) throw fail(503, "ยังไม่ได้ตั้งค่าฐานข้อมูล กรุณาติดต่อผู้ดูแล"); return pool; }
function text(value, label, min, max) {
  if (typeof value !== "string") throw fail(400, `กรุณาระบุ${label}`);
  const result = value.trim().normalize("NFC");
  if ([...result].length < min || [...result].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) {
    throw fail(400, `${label}ต้องมี ${min}–${max} ตัวอักษร และไม่มีอักขระควบคุม`);
  }
  return result;
}
function fields(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw fail(400, "ข้อมูลไม่ถูกต้อง");
}
function credentials(body) {
  const email = text(body.email, "อีเมล", 3, 190).toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) throw fail(400, "รูปแบบอีเมลไม่ถูกต้อง");
  if (typeof body.password !== "string" || [...body.password].length < 12 || [...body.password].length > 128 || Buffer.byteLength(body.password) > 512) throw fail(400, "รหัสผ่านต้องมี 12–128 ตัวอักษร");
  return { email, password: body.password };
}
let hashing = 0;
async function passwordKey(password, salt) {
  if (hashing >= 3) throw fail(429, "ระบบกำลังทำงาน กรุณาลองใหม่สักครู่");
  hashing++;
  try { return await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }); }
  finally { hashing--; }
}
// Bounded, process-local rate limiting. Do not trust client-supplied forwarding headers.
const buckets = new Map();
function limit(req, res, next) {
  const now = Date.now();
  for (const [key, item] of buckets) if (item.until <= now) buckets.delete(key);
  const key = `${req.socket.remoteAddress}:${req.path.startsWith("/auth/") ? "auth" : "write"}`;
  let item = buckets.get(key);
  if (!item) {
    if (buckets.size >= 2000) return next(fail(429, "กรุณาลองใหม่ภายหลัง"));
    item = { count: 0, until: now + 15 * 60 * 1000 };
    buckets.set(key, item);
  }
  if (++item.count > (req.path.startsWith("/auth/") ? 30 : 60)) {
    res.set("Retry-After", String(Math.ceil((item.until - now) / 1000)));
    return next(fail(429, "ทำรายการบ่อยเกินไป กรุณารอสักครู่"));
  }
  next();
}
function tokenFrom(req) {
  const part = (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  const token = part ? part.slice(cookieName.length + 1) : "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function member(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return next(fail(401, "กรุณาเข้าสู่ระบบก่อน"));
  const rows = await db().query("SELECT u.id, u.display_name AS name FROM tt_users u JOIN tt_sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() LIMIT 1", [hashToken(token)]);
  if (!rows.length) return next(fail(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"));
  req.user = rows[0];
  next();
}
async function session(req, res, user) {
  const token = randomBytes(32).toString("hex");
  await db().query("DELETE FROM tt_sessions WHERE expires_at <= UTC_TIMESTAMP()");
  await db().query("INSERT INTO tt_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))", [hashToken(token), user.id]);
  const previous = tokenFrom(req);
  if (previous) await db().query("DELETE FROM tt_sessions WHERE token_hash = ?", [hashToken(previous)]);
  res.cookie(cookieName, token, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: sessionSeconds * 1000 });
  res.json({ user: { id: user.id, name: user.name } });
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  });
  next();
});
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (/^\/health\/?$/i.test(req.path) && req.method !== "GET") return res.status(405).set("Allow", "GET").json({ error: "Method not allowed" });
  if (!["GET", "HEAD", "POST", "DELETE"].includes(req.method)) return res.status(405).set("Allow", "GET, HEAD, POST, DELETE").json({ error: "Method not allowed" });
  if (["POST", "DELETE"].includes(req.method)) {
    // Exact configured origin plus a non-simple JSON header prevents cross-site mutations.
    if (req.headers.origin !== origin || !req.is("application/json")) return next(fail(403, "คำขอไม่ถูกต้อง กรุณาเปิดเว็บไซต์จาก URL ที่ตั้งค่าไว้"));
    return limit(req, res, next);
  }
  next();
});
app.use("/api", express.json({ limit: "16kb", strict: true }));
app.get("/api/health", async (req, res) => {
  if (Object.keys(req.query).length || req.headers["content-type"] || req.headers["transfer-encoding"] || (req.headers["content-length"] && req.headers["content-length"] !== "0")) return res.status(400).json({ error: "This endpoint accepts no query parameters or body." });
  try {
    await db().query("SELECT 1");
    await db().query("SELECT id FROM tt_users LIMIT 0");
    await db().query("SELECT token_hash FROM tt_sessions LIMIT 0");
    await db().query("SELECT id FROM tt_posts LIMIT 0");
    res.json({ status: "ok", database: "connected" });
  } catch { res.status(503).json({ status: "unavailable", database: "unavailable" }); }
});
app.all("/api/health", (req, res) => res.status(405).set("Allow", "GET").json({ error: "Method not allowed" }));
app.get("/api/places", (req, res) => res.json({ places }));
app.get("/api/auth/me", member, (req, res) => res.json({ user: req.user }));
app.post("/api/auth/register", async (req, res) => {
  fields(req.body, ["name", "email", "password"]);
  const name = text(req.body.name, "ชื่อที่แสดง", 2, 60);
  const { email, password } = credentials(req.body);
  db();
  const salt = randomBytes(16).toString("hex");
  const key = await passwordKey(password, salt);
  try {
    const result = await db().query("INSERT INTO tt_users (display_name, email, password_hash) VALUES (?, ?, ?)", [name, email, `${salt}:${key.toString("hex")}`]);
    res.status(201);
    await session(req, res, { id: Number(result.insertId), name });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw fail(409, "ไม่สามารถสมัครด้วยอีเมลนี้ได้ กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น");
    throw error;
  }
});
app.post("/api/auth/login", async (req, res) => {
  fields(req.body, ["email", "password"]);
  const { email, password } = credentials(req.body);
  const rows = await db().query("SELECT id, display_name AS name, password_hash FROM tt_users WHERE email = ? LIMIT 1", [email]);
  const [salt, stored] = rows.length ? rows[0].password_hash.split(":") : ["0".repeat(32), "0".repeat(128)];
  const key = await passwordKey(password, salt);
  if (!timingSafeEqual(key, Buffer.from(stored, "hex")) || !rows.length) throw fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  await session(req, res, rows[0]);
});
app.post("/api/auth/logout", async (req, res) => {
  fields(req.body, []);
  const token = tokenFrom(req);
  if (token) await db().query("DELETE FROM tt_sessions WHERE token_hash = ?", [hashToken(token)]);
  res.clearCookie(cookieName, { httpOnly: true, secure, sameSite: "strict", path: "/" });
  res.json({ ok: true });
});
app.get("/api/posts", async (req, res) => {
  if (Object.keys(req.query).some(key => !["before", "place"].includes(key))) throw fail(400, "ตัวกรองไม่ถูกต้อง");
  const before = req.query.before === undefined ? 2147483647 : Number(req.query.before);
  if (!Number.isInteger(before) || before < 1 || before > 2147483647) throw fail(400, "หน้าข้อมูลไม่ถูกต้อง");
  const place = req.query.place || "";
  if (typeof place !== "string" || (place && !places.some(item => item.id === place))) throw fail(400, "สถานที่ไม่ถูกต้อง");
  const rows = await db().query("SELECT p.id, p.user_id AS userId, u.display_name AS author, p.place_id AS placeId, p.title, p.body, p.rating, DATE_FORMAT(p.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt FROM tt_posts p JOIN tt_users u ON u.id = p.user_id WHERE p.id < ? AND (? = '' OR p.place_id = ?) AND p.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 365 DAY) ORDER BY p.id DESC LIMIT 13", [before, place, place]);
  const hasMore = rows.length > 12;
  const posts = rows.slice(0, 12);
  res.json({ posts, next: hasMore ? posts[posts.length - 1].id : null });
});
app.post("/api/posts", member, async (req, res) => {
  fields(req.body, ["placeId", "title", "body", "rating"]);
  const title = text(req.body.title, "หัวข้อ", 4, 120);
  const body = text(req.body.body, "เรื่องเล่า", 20, 2000);
  if (!places.some(place => place.id === req.body.placeId)) throw fail(400, "กรุณาเลือกสถานที่");
  if (!Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) throw fail(400, "คะแนนต้องเป็นจำนวนเต็ม 1–5");
  const result = await db().query("INSERT INTO tt_posts (user_id, place_id, title, body, rating) VALUES (?, ?, ?, ?, ?)", [req.user.id, req.body.placeId, title, body, req.body.rating]);
  res.status(201).json({ id: Number(result.insertId) });
});
app.delete("/api/posts/:id", member, async (req, res) => {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) throw fail(400, "รหัสโพสต์ไม่ถูกต้อง");
  const result = await db().query("DELETE FROM tt_posts WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
  if (!result.affectedRows) throw fail(404, "ไม่พบโพสต์หรือคุณไม่มีสิทธิ์ลบ");
  res.json({ ok: true });
});
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found" }));
app.use(express.static(path.join(__dirname, "public"), { dotfiles: "deny", index: "index.html" }));
app.use((req, res) => res.status(404).type("text").send("Not found"));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") return res.status(413).json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" });
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "รูปแบบ JSON ไม่ถูกต้อง" });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error("Request failed:", error.code || "UNKNOWN");
  res.status(503).json({ error: "ระบบข้อมูลยังไม่พร้อม กรุณาตรวจสอบ .env และนำเข้าตารางผ่านหน้าฐานข้อมูล หรือลองใหม่ภายหลัง" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Travel Together p01 listening on port ${port}; database ${configured ? "configured" : "not configured"}.`);
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on("error", error => {
  console.error("Server could not start:", error.code || "UNKNOWN");
  if (pool) pool.end().finally(() => { process.exitCode = 1; });
  else process.exitCode = 1;
});
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  server.close(async () => { if (pool) await pool.end(); clearTimeout(timer); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

