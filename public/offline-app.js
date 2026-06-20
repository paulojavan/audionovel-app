const DB_NAME = "audio-novel-br-audio-cache";
const AUDIO_STORE = "audios";
const OFFLINE_STORE = "offlineItems";
const KEY_NAME = "audio-novel-br-audio-cache-key";

let audioUrl = "";
let activeId = "";

const audio = document.getElementById("audio");
const list = document.getElementById("list");
const nowTitle = document.getElementById("now-title");
const nowSubtitle = document.getElementById("now-subtitle");
const playButton = document.getElementById("play");
const progressBar = document.getElementById("progress-bar");
const seek = document.getElementById("seek");
const currentTime = document.getElementById("current-time");
const duration = document.getElementById("duration");
const message = document.getElementById("message");

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(AUDIO_STORE)) request.result.createObjectStore(AUDIO_STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(OFFLINE_STORE)) request.result.createObjectStore(OFFLINE_STORE, { keyPath: "chapterId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getCryptoKey() {
  const existing = localStorage.getItem(KEY_NAME);
  if (!existing) throw new Error("Chave offline nao encontrada.");
  return crypto.subtle.importKey("raw", base64ToArrayBuffer(existing), "AES-GCM", false, ["decrypt"]);
}

async function readAllOfflineItems() {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(OFFLINE_STORE, "readonly").objectStore(OFFLINE_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function readAudioRecord(chapterId) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(AUDIO_STORE, "readonly").objectStore(AUDIO_STORE).get(`offline:chapter:${chapterId}`);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function deleteOfflineItem(chapterId) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_STORE, AUDIO_STORE], "readwrite");
    tx.objectStore(OFFLINE_STORE).delete(chapterId);
    tx.objectStore(AUDIO_STORE).delete(`offline:chapter:${chapterId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

async function getValidItems() {
  const now = Date.now();
  const items = await readAllOfflineItems();
  const valid = [];

  for (const item of items) {
    const record = await readAudioRecord(item.chapterId);
    if (!record || record.expiresAt <= now || new Date(item.expiresAt).getTime() <= now) {
      await deleteOfflineItem(item.chapterId);
    } else {
      valid.push(item);
    }
  }

  return valid.sort((a, b) => a.novelTitle.localeCompare(b.novelTitle, "pt-BR") || a.volumeTitle.localeCompare(b.volumeTitle, "pt-BR") || a.chapterPosition - b.chapterPosition);
}

async function getAudioUrl(item) {
  const record = await readAudioRecord(item.chapterId);
  if (!record || record.expiresAt <= Date.now()) {
    await deleteOfflineItem(item.chapterId);
    throw new Error("Audio expirado.");
  }

  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.data);
  return URL.createObjectURL(new Blob([decrypted], { type: record.mimeType || "audio/mpeg" }));
}

function groupByNovel(items) {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.novelTitle) || [];
    group.push(item);
    groups.set(item.novelTitle, group);
  }
  return Array.from(groups.entries()).map(([novelTitle, groupItems]) => ({ novelTitle, items: groupItems }));
}

function renderItems(items) {
  if (!items.length) {
    list.innerHTML = '<p class="panel muted">Nenhum capitulo offline salvo neste dispositivo.</p>';
    return;
  }

  list.innerHTML = "";
  groupByNovel(items).forEach((group, index) => {
    const details = document.createElement("details");
    details.open = index === 0;
    details.innerHTML = `<summary><span>${escapeHtml(group.novelTitle)}</span><span>${group.items.length} salvo(s)</span></summary>`;
    const chapters = document.createElement("div");
    chapters.className = "chapters";

    group.items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chapter${item.id === activeId ? " active" : ""}`;
      button.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span class="muted">${escapeHtml(item.volumeTitle)} - Capitulo ${item.chapterPosition}</span><span class="muted">Disponivel ate ${new Date(item.expiresAt).toLocaleDateString("pt-BR")}</span>`;
      button.addEventListener("click", () => playItem(item));
      chapters.appendChild(button);
    });

    details.appendChild(chapters);
    list.appendChild(details);
  });
}

async function playItem(item) {
  try {
    hideMessage();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = await getAudioUrl(item);
    activeId = item.id;
    audio.src = audioUrl;
    nowTitle.textContent = item.title;
    nowSubtitle.textContent = `${item.novelTitle} - ${item.volumeTitle}`;
    playButton.disabled = false;
    await audio.play();
    playButton.textContent = "Pause";
    renderItems(await getValidItems());
  } catch {
    showMessage("Nao foi possivel abrir este audio offline. Ele pode ter expirado.");
    renderItems(await getValidItems());
  }
}

function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
}

playButton.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    playButton.textContent = "Pause";
  } else {
    audio.pause();
    playButton.textContent = "Play";
  }
});

document.getElementById("back").addEventListener("click", () => {
  audio.currentTime = Math.max(0, audio.currentTime - 10);
});

document.getElementById("forward").addEventListener("click", () => {
  audio.currentTime = Math.min(audio.duration || Number.POSITIVE_INFINITY, audio.currentTime + 10);
});

document.getElementById("volume").addEventListener("input", (event) => {
  audio.volume = Number(event.target.value);
});

document.getElementById("speed").addEventListener("change", (event) => {
  audio.playbackRate = Number(event.target.value);
});

seek.addEventListener("input", (event) => {
  audio.currentTime = Number(event.target.value);
});

audio.addEventListener("timeupdate", () => {
  const total = Number.isFinite(audio.duration) ? audio.duration : 0;
  progressBar.style.width = total ? `${Math.min(100, (audio.currentTime / total) * 100)}%` : "0%";
  seek.max = String(total);
  seek.value = String(audio.currentTime);
  currentTime.textContent = formatTime(audio.currentTime);
  duration.textContent = total ? formatTime(total) : "--:--";
});

audio.addEventListener("ended", () => {
  playButton.textContent = "Play";
});

getValidItems()
  .then(renderItems)
  .catch(() => {
    list.innerHTML = '<p class="panel muted">Nao foi possivel carregar os capitulos offline deste dispositivo.</p>';
  });
