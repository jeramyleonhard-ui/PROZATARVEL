"use strict";

const $ = id => document.getElementById(id);
const state = { places: [], user: null, category: "", next: null, posts: [], register: false, shareAfterLogin: false, selectedPlace: null };
let toastTimer;
let postsRequest = 0;
function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 6000);
}
async function api(url, options = {}) {
  try {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(12000), ...options });
    if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง");
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "ระบบข้อมูลยังไม่พร้อม กรุณาลองใหม่");
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่");
    if (error instanceof TypeError) throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบเครือข่าย");
    throw error;
  }
}
const mutation = (url, method, data = {}) => api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
function empty(container, title, description) {
  const box = element("div", "empty-state");
  box.append(element("strong", "", title), element("p", "", description));
  container.replaceChildren(box);
}
function updateAccount() {
  $("login-button").hidden = Boolean(state.user);
  $("logout-button").hidden = !state.user;
  $("member-name").hidden = !state.user;
  $("member-name").textContent = state.user ? state.user.name : "";
  renderPosts();
}
function authMode(register) {
  state.register = register;
  $("auth-form").reset();
  $("auth-error").textContent = "";
  $("name-field").hidden = !register;
  $("auth-name").required = register;
  $("auth-title").textContent = register ? "มาเป็นเพื่อนร่วมทางกัน" : "ดีใจที่ได้เจอกัน";
  $("auth-description").textContent = register ? "สร้างบัญชีเพื่อเก็บและแบ่งปันเรื่องเล่าของคุณ" : "เข้าสู่ระบบ แล้วมาแบ่งปันการเดินทางกัน";
  $("auth-password").autocomplete = register ? "new-password" : "current-password";
  $("auth-submit").textContent = register ? "สมัครสมาชิก ↗" : "เข้าสู่ระบบ ↗";
  $("auth-toggle").textContent = register ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก";
}
function openAuth(share = false) {
  state.shareAfterLogin = share;
  authMode(false);
  $("auth-dialog").showModal();
}
function openShare(placeId = "") {
  if (!state.user) { openAuth(true); return; }
  $("post-error").textContent = "";
  if (placeId) $("write-place").value = placeId;
  $("post-dialog").showModal();
}
document.querySelectorAll(".close-dialog").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
$("login-button").addEventListener("click", () => openAuth());
$("hero-share").addEventListener("click", () => openShare());
$("share-button").addEventListener("click", () => openShare());
$("auth-toggle").addEventListener("click", () => authMode(!state.register));
$("auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("auth-submit");
  if (button.disabled) return;
  const form = new FormData(event.currentTarget);
  const data = { email: form.get("email"), password: form.get("password") };
  if (state.register) data.name = form.get("name");
  button.disabled = true;
  $("auth-toggle").disabled = true;
  $("auth-error").textContent = "";
  try {
    const result = await mutation(`/api/auth/${state.register ? "register" : "login"}`, "POST", data);
    state.user = result.user;
    updateAccount();
    $("auth-dialog").close();
    $("auth-form").reset();
    toast("ยินดีต้อนรับ มาแบ่งปันการเดินทางกัน");
    if (state.shareAfterLogin) openShare();
  } catch (error) { $("auth-error").textContent = error.message; }
  finally { button.disabled = false; $("auth-toggle").disabled = false; }
});
$("logout-button").addEventListener("click", async () => {
  $("logout-button").disabled = true;
  try {
    await mutation("/api/auth/logout", "POST");
    state.user = null;
    updateAccount();
    $("post-form").reset();
    toast("ออกจากระบบแล้ว แล้วพบกันทริปหน้า");
  } catch (error) { toast(error.message); }
  finally { $("logout-button").disabled = false; }
});
// Local, re-encoded photographs keep the same-origin image policy intact.
const PLACE_PHOTOS = {
  "thi-lo-su": { file: "Thi_Lo_Su_Waterfall,_Umphang_Wildlife_Sanctuary,_Tak_Province,_Thailand.jpg", author: "Snobbird", license: "CC BY-SA 4.0", alt: "น้ำตกทีลอซูท่ามกลางป่าอุ้มผาง" },
  "doi-soi-malai": { file: "Grassy_Ridge_at_Doi_Soi_Malai_National_Park,_Thailand.jpg", author: "วุฒิภัทร เนตรเพชร", license: "CC BY-SA 4.0", alt: "สันเขาและจุดกางเต็นท์ในอุทยานแห่งชาติดอยสอยมาลัย" },
  "bhumibol-dam": { file: "Bhumibol_Dam_3.jpg", author: "PumpkinSky", license: "CC BY-SA 4.0", alt: "เขื่อนภูมิพล จังหวัดตาก" },
  "mae-sot": { file: "Rim_Moei.jpg", author: "Lerdsuwa", license: "CC BY-SA 3.0", alt: "ตลาดริมเมย อำเภอแม่สอด" },
  "lan-sang": { file: "Lan_Sang_Waterfall_(dry_season).jpg", author: "Martin Püschel (Spreesprotte)", license: "CC BY-SA 3.0", alt: "น้ำตกลานสางในฤดูแล้ง" },
  "ban-tak": { file: "Wat_Phra_Tat_Ban_Tak.jpg", author: "watanyou intachai", license: "CC BY 2.0", alt: "พระเจดีย์วัดพระบรมธาตุบ้านตาก" }
};
function applyPlacePhoto(node, place) {
  node.querySelector(".place-photo")?.remove();
  const photo = PLACE_PHOTOS[place.id];
  if (!photo) return;
  const image = element("img", "place-photo");
  image.src = `/images/${place.id}.jpg`;
  image.alt = node.tagName === "BUTTON" ? "" : photo.alt;
  image.loading = node.tagName === "BUTTON" ? "lazy" : "eager";
  image.decoding = "async";
  node.prepend(image);
}

function showPlace(place) {
  state.selectedPlace = place;
  $("detail-title").textContent = place.name;
  $("detail-meta").textContent = `อ.${place.district} / ${place.category}`;
  $("detail-description").textContent = place.description;
  $("detail-art").className = `detail-art landscape ${place.landscape || ""}`;
  applyPlacePhoto($("detail-art"), place);
  const photo = PLACE_PHOTOS[place.id];
  $("detail-credit").replaceChildren();
  if (photo) {
    const credit = element("a", "photo-credit", `ภาพ: ${photo.author} / ${photo.license} · Wikimedia Commons`);
    credit.href = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file)}`;
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    $("detail-credit").append(credit);
  }
  $("place-dialog").showModal();
}
function renderPlaces() {
  const query = $("search").value.trim().normalize("NFC").toLocaleLowerCase("th");
  const district = $("district").value;
  const places = state.places.filter(place => (!state.category || place.category === state.category) && (!district || place.district === district) && `${place.name} ${place.district} ${place.category} ${place.tag}`.toLocaleLowerCase("th").includes(query));
  $("place-count").textContent = `${places.length} สถานที่น่าไป`;
  $("places").replaceChildren();
  if (!places.length) { empty($("places"), "ยังไม่เจอสถานที่ที่ค้นหา", "ลองเปลี่ยนคำค้น อำเภอ หรือเลือกประเภททั้งหมด"); return; }
  for (const place of places) {
    const card = element("article", "place-card");
    const art = element("button", `card-art landscape ${place.landscape}`);
    art.type = "button";
    applyPlacePhoto(art, place);
    art.setAttribute("aria-label", `ดูรายละเอียด ${place.name}`);
    art.append(element("span", "card-tag", place.category), element("span", "card-number", String(state.places.indexOf(place) + 1).padStart(2, "0")));
    art.addEventListener("click", () => showPlace(place));
    const body = element("div", "card-body");
    body.append(element("p", "card-meta", `อ.${place.district} · จังหวัดตาก`), element("h3", "", place.name), element("p", "", place.tag));
    const bottom = element("div", "card-bottom");
    const more = element("button", "text-button", "ทำความรู้จัก ↗");
    more.type = "button";
    more.addEventListener("click", () => showPlace(place));
    bottom.append(element("span", "muted", "TRAVEL TOGETHER"), more);
    body.append(bottom);
    card.append(art, body);
    $("places").append(card);
  }
}
$("search-form").addEventListener("submit", event => { event.preventDefault(); renderPlaces(); });
$("search").addEventListener("input", renderPlaces);
$("district").addEventListener("change", renderPlaces);
document.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
  state.category = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderPlaces();
}));
$("detail-stories").addEventListener("click", () => {
  $("place-dialog").close();
  $("post-place").value = state.selectedPlace.id;
  loadPosts();
  $("community").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});
function renderPosts() {
  $("posts").replaceChildren();
  for (const post of state.posts) {
    const card = element("article", "post-card");
    const author = element("div", "post-author");
    const authorInfo = element("div", "", post.author);
    const date = new Date(post.createdAt);
    authorInfo.append(element("span", "post-date", Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date)));
    author.append(element("span", "avatar", [...post.author][0] || "T"), authorInfo);
    card.append(author, element("p", "post-rating", `${"★".repeat(post.rating)}${"☆".repeat(5 - post.rating)} · ${post.rating}/5`), element("h3", "", post.title), element("p", "post-body", post.body));
    const footer = element("div", "post-footer");
    footer.append(element("span", "", state.places.find(place => place.id === post.placeId)?.name || "จังหวัดตาก"));
    if (state.user && state.user.id === post.userId) {
      const remove = element("button", "delete-post", "ลบเรื่องเล่า");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm("ต้องการลบเรื่องเล่านี้ถาวรใช่ไหม?")) return;
        remove.disabled = true;
        try {
          await mutation(`/api/posts/${post.id}`, "DELETE");
          toast("ลบเรื่องเล่าแล้ว");
          await loadPosts();
        } catch (error) { toast(error.message); remove.disabled = false; if (error.status === 401) { state.user = null; updateAccount(); } }
      });
      footer.append(remove);
    }
    card.append(footer);
    $("posts").append(card);
  }
}
async function loadPosts(append = false) {
  const request = ++postsRequest;
  $("refresh-posts").disabled = true;
  $("load-more").disabled = true;
  $("db-notice").hidden = false;
  $("db-notice").className = "notice";
  $("db-notice").textContent = "กำลังโหลดเรื่องเล่าจากนักเดินทาง…";
  if (!append) { state.posts = []; state.next = null; $("posts").replaceChildren(); $("load-more").hidden = true; }
  try {
    const params = new URLSearchParams();
    if ($("post-place").value) params.set("place", $("post-place").value);
    if (append && state.next) params.set("before", state.next);
    const data = await api(`/api/posts${params.size ? `?${params}` : ""}`);
    if (request !== postsRequest) return;
    state.posts = append ? [...state.posts, ...data.posts] : data.posts;
    state.next = data.next;
    renderPosts();
    $("db-notice").hidden = true;
    $("load-more").hidden = !state.next;
    if (!state.posts.length) empty($("posts"), "เรื่องเล่าแรก อาจเป็นของคุณ", "ยังไม่มีเรื่องเล่าในหมวดนี้ ลองแบ่งปันประสบการณ์จริงจากทริปของคุณ");
  } catch (error) {
    if (request !== postsRequest) return;
    $("db-notice").className = "notice warning";
    $("db-notice").textContent = `${error.message} · กดรีเฟรชเพื่อลองอีกครั้ง`;
  } finally {
    if (request === postsRequest) { $("refresh-posts").disabled = false; $("load-more").disabled = false; }
  }
}
$("post-place").addEventListener("change", () => loadPosts());
$("refresh-posts").addEventListener("click", () => loadPosts());
$("load-more").addEventListener("click", () => loadPosts(true));
$("post-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  if (button.disabled) return;
  button.disabled = true;
  $("post-error").textContent = "";
  const values = Object.fromEntries(new FormData(form));
  values.rating = Number(values.rating);
  try {
    await mutation("/api/posts", "POST", values);
    form.reset();
    $("post-dialog").close();
    $("post-place").value = "";
    toast("บันทึกเรื่องเล่าลงฐานข้อมูลแล้ว ขอบคุณที่แบ่งปัน");
    await loadPosts();
    $("community").scrollIntoView();
  } catch (error) {
    $("post-error").textContent = error.message;
    if (error.status === 401) { state.user = null; updateAccount(); $("post-dialog").close(); openAuth(true); }
  } finally { button.disabled = false; }
});
async function start() {
  try {
    const data = await api("/api/places");
    state.places = data.places;
    for (const place of state.places) {
      for (const id of ["post-place", "write-place"]) {
        const option = element("option", "", place.name);
        option.value = place.id;
        $(id).append(option);
      }
    }
    renderPlaces();
  } catch (error) { $("place-count").textContent = "โหลดข้อมูลไม่ได้"; empty($("places"), "ยังโหลดสถานที่ไม่ได้", error.message); }
  try { const data = await api("/api/auth/me"); state.user = data.user; updateAccount(); }
  catch (error) { if (error.status !== 401) toast("ระบบสมาชิกยังไม่พร้อม กรุณาตรวจสอบการตั้งค่าฐานข้อมูล"); }
  await loadPosts();
}
start();

