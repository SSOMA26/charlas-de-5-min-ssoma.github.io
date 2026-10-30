(() => {
  "use strict";

  const TOPICS = window.SSOMA_TOPICS || [];
  const STORAGE_KEY = "ssoma-schedule-2026-v1";
  const DB_NAME = "ssoma-evidence-db";
  const STORE_NAME = "evidences";
  const MONTHS = {
    "2026-11": { year: 2026, monthIndex: 10, label: "Noviembre de 2026", startDay: 2 },
    "2026-12": { year: 2026, monthIndex: 11, label: "Diciembre de 2026", startDay: 1 }
  };
  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  let evidenceUrls = [];
  let toastTimer;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const topicById = id => TOPICS.find(topic => topic.id === Number(id));

  function eligibleDates(year, monthIndex, startDay = 1) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const dates = [];
    for (let day = startDay; day <= lastDay; day += 1) {
      const date = new Date(year, monthIndex, day);
      if (date.getDay() !== 0) dates.push(formatDate(date));
    }
    return dates;
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function makeSession(date, topicId, suffix = "1") {
    return {
      id: `${date}-${suffix}`,
      topicId,
      responsible: "",
      completed: false,
      evidence: null
    };
  }

  function buildNovember() {
    const dates = eligibleDates(2026, 10, 2);
    return dates.map((date, index) => {
      const sessions = [makeSession(date, index + 1)];
      if (index === dates.length - 1) sessions.push(makeSession(date, 26, "2"));
      return { date, sessions };
    });
  }

  function buildDecember() {
    const dates = eligibleDates(2026, 11, 1);
    return dates.map((date, index) => {
      // Diciembre tiene 27 jornadas sin domingo. El día 31 refuerza el tema 7.
      const topicId = index < 26 ? index + 1 : 7;
      return { date, sessions: [makeSession(date, topicId)] };
    });
  }

  function initialState() {
    return {
      version: 1,
      activeMonth: "2026-11",
      schedules: { "2026-11": buildNovember() },
      updatedAt: new Date().toISOString()
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === 1 && saved.schedules?.["2026-11"]) return saved;
    } catch (error) {
      console.warn("No se pudo leer el estado guardado.", error);
    }
    return initialState();
  }

  let state = loadState();

  function saveState() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbAction(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  const getEvidence = id => dbAction("readonly", store => store.get(id));
  const getAllEvidence = () => dbAction("readonly", store => store.getAll());
  const putEvidence = record => dbAction("readwrite", store => store.put(record));
  const deleteEvidence = id => dbAction("readwrite", store => store.delete(id));
  const clearEvidence = () => dbAction("readwrite", store => store.clear());

  function getActiveSchedule() {
    return state.schedules[state.activeMonth] || [];
  }

  function findSession(sessionId) {
    for (const [month, days] of Object.entries(state.schedules)) {
      for (const day of days) {
        const session = day.sessions.find(item => item.id === sessionId);
        if (session) return { month, day, session };
      }
    }
    return null;
  }

  function showToast(message, isError = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function updateStats() {
    const sessions = getActiveSchedule().flatMap(day => day.sessions);
    const completed = sessions.filter(session => session.completed).length;
    const evidence = sessions.filter(session => session.evidence).length;
    $("#stat-sessions").textContent = sessions.length;
    $("#stat-completed").textContent = completed;
    $("#stat-evidence").textContent = evidence;
    $("#stat-progress").textContent = sessions.length ? `${Math.round((completed / sessions.length) * 100)}%` : "0%";
    $("#calendar-summary").textContent = `${getActiveSchedule().length} jornadas · ${sessions.length} charlas`;
  }

  function matchesFilters(session) {
    const search = $("#search").value.trim().toLocaleLowerCase("es");
    const status = $("#status-filter").value;
    const topic = topicById(session.topicId);
    const haystack = `${topic?.title || ""} ${session.responsible || ""}`.toLocaleLowerCase("es");
    const searchMatch = !search || haystack.includes(search);
    const statusMatch = status === "all"
      || (status === "pending" && !session.completed)
      || (status === "completed" && session.completed)
      || (status === "evidence" && Boolean(session.evidence))
      || (status === "unassigned" && !session.responsible.trim());
    return searchMatch && statusMatch;
  }

  function releaseEvidenceUrls() {
    evidenceUrls.forEach(url => URL.revokeObjectURL(url));
    evidenceUrls = [];
  }

  function topicOptions(selectedId) {
    return TOPICS.map(topic => `<option value="${topic.id}" ${topic.id === Number(selectedId) ? "selected" : ""}>${topic.id}. ${escapeHtml(topic.title)}</option>`).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function renderCalendar() {
    releaseEvidenceUrls();
    const month = MONTHS[state.activeMonth];
    const schedule = getActiveSchedule();
    const grid = $("#calendar-grid");
    const calendar = $("#calendario");
    const empty = $("#empty-december");
    $("#calendar-title").textContent = month.label;
    $$(".month-button").forEach(button => button.classList.toggle("is-active", button.dataset.month === state.activeMonth));

    const decemberMissing = state.activeMonth === "2026-12" && !state.schedules["2026-12"];
    empty.hidden = !decemberMissing;
    calendar.hidden = decemberMissing;
    $("#create-december").hidden = Boolean(state.schedules["2026-12"]);

    if (decemberMissing) {
      grid.replaceChildren();
      updateStats();
      updateNotice();
      return;
    }

    const fragment = document.createDocumentFragment();
    ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].forEach(name => {
      const heading = document.createElement("div");
      heading.className = "weekday";
      heading.textContent = name;
      fragment.appendChild(heading);
    });

    if (schedule.length) {
      const firstDate = parseLocalDate(schedule[0].date);
      const mondayIndex = firstDate.getDay() - 1;
      for (let index = 0; index < mondayIndex; index += 1) {
        const blank = document.createElement("div");
        blank.className = "calendar-blank";
        blank.setAttribute("aria-hidden", "true");
        fragment.appendChild(blank);
      }
    }

    let visibleDays = 0;
    schedule.forEach(day => {
      const matchingSessions = day.sessions.filter(matchesFilters);
      const card = createDayCard(day, matchingSessions);
      if (!matchingSessions.length) card.classList.add("is-hidden");
      else visibleDays += 1;
      fragment.appendChild(card);
    });

    grid.replaceChildren(fragment);
    $("#no-results").hidden = visibleDays > 0;
    updateStats();
    updateNotice();
  }

  function createDayCard(day, displayedSessions) {
    const card = $("#day-template").content.firstElementChild.cloneNode(true);
    const date = parseLocalDate(day.date);
    card.dataset.date = day.date;
    card.classList.toggle("is-double", day.sessions.length > 1);
    $(".day-name", card).textContent = DAY_NAMES[date.getDay()];
    $(".day-number", card).textContent = date.getDate();
    $(".session-count", card).textContent = day.sessions.length > 1 ? `${day.sessions.length} charlas` : "1 charla";
    const list = $(".session-list", card);
    displayedSessions.forEach(session => list.appendChild(createSessionCard(session, day)));
    $(".add-session", card).addEventListener("click", () => addSession(day.date));
    return card;
  }

  function createSessionCard(session, day) {
    const card = $("#session-template").content.firstElementChild.cloneNode(true);
    card.dataset.sessionId = session.id;
    card.classList.toggle("is-completed", session.completed);
    const select = $(".topic-select", card);
    select.innerHTML = topicOptions(session.topicId);
    updateTopicPreview(card, session.topicId);
    const removeButton = $(".remove-session", card);
    removeButton.hidden = day.sessions.length <= 1;
    removeButton.addEventListener("click", () => removeSession(day.date, session.id));
    select.addEventListener("change", () => {
      session.topicId = Number(select.value);
      saveState();
      updateTopicPreview(card, session.topicId);
      renderTopicLibrary();
      showToast("Tema actualizado.");
    });

    const responsible = $(".responsible-input", card);
    responsible.value = session.responsible;
    responsible.addEventListener("input", () => {
      session.responsible = responsible.value;
      saveState();
      updateStats();
    });

    const completed = $(".completed-checkbox", card);
    completed.checked = session.completed;
    completed.addEventListener("change", () => {
      session.completed = completed.checked;
      card.classList.toggle("is-completed", session.completed);
      saveState();
      updateStats();
      showToast(session.completed ? "Charla marcada como cumplida." : "Charla marcada como pendiente.");
    });

    $(".evidence-input", card).addEventListener("change", event => handleEvidenceUpload(event, session.id));
    $(".evidence-remove", card).addEventListener("click", () => removeEvidence(session.id));
    if (session.evidence) hydrateEvidence(card, session);
    return card;
  }

  function updateTopicPreview(card, topicId) {
    const topic = topicById(topicId);
    if (!topic) return;
    const image = $(".topic-image", card);
    image.src = topic.image;
    image.alt = `Ficha visual: ${topic.title}`;
    $(".topic-number", card).textContent = `Tema ${topic.id}`;
    $(".topic-title", card).textContent = topic.title;
    $(".topic-objective", card).textContent = topic.objective;
    const download = $(".download-link", card);
    download.href = topic.image;
    download.download = `SSOMA-${String(topic.id).padStart(2, "0")}-${slugify(topic.title)}.webp`;
    $(".image-button", card).onclick = () => openImageDialog(topic.image, `Tema ${topic.id}: ${topic.title}`);
  }

  function openImageDialog(src, title) {
    const dialog = $("#image-dialog");
    $("#dialog-image").src = src;
    $("#dialog-image").alt = title;
    $("#dialog-title").textContent = title;
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  async function hydrateEvidence(card, session) {
    try {
      const record = await getEvidence(session.id);
      if (!record?.blob || !card.isConnected) return;
      const url = URL.createObjectURL(record.blob);
      evidenceUrls.push(url);
      const panel = $(".evidence-panel", card);
      panel.hidden = false;
      $(".evidence-image", card).src = url;
      $(".evidence-name", card).textContent = session.evidence.name;
      $(".evidence-date", card).textContent = new Date(session.evidence.updatedAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
      const download = $(".evidence-download", card);
      download.href = url;
      download.download = session.evidence.name || `evidencia-${session.id}.jpg`;
      $(".upload-label", card).textContent = "Cambiar evidencia";
    } catch (error) {
      console.error(error);
    }
  }

  async function handleEvidenceUpload(event, sessionId) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Seleccione un archivo de imagen válido.", true);
      input.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast("La imagen no debe superar 20 MB.", true);
      input.value = "";
      return;
    }
    try {
      const blob = await optimizeImage(file);
      const found = findSession(sessionId);
      if (!found) return;
      const name = `${sessionId}-evidencia.jpg`;
      const updatedAt = new Date().toISOString();
      await putEvidence({ id: sessionId, blob, name, originalName: file.name, updatedAt });
      found.session.evidence = { name, originalName: file.name, updatedAt, size: blob.size };
      saveState();
      renderCalendar();
      showToast("Evidencia guardada correctamente.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo procesar la imagen.", true);
    } finally {
      input.value = "";
    }
  }

  async function optimizeImage(file) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen")), "image/jpeg", .84));
  }

  async function removeEvidence(sessionId) {
    const found = findSession(sessionId);
    if (!found) return;
    await deleteEvidence(sessionId);
    found.session.evidence = null;
    saveState();
    renderCalendar();
    showToast("Evidencia eliminada.");
  }

  function addSession(date) {
    const day = getActiveSchedule().find(item => item.date === date);
    if (!day) return;
    const used = new Set(getActiveSchedule().flatMap(item => item.sessions.map(session => session.topicId)));
    const nextTopic = TOPICS.find(topic => !used.has(topic.id)) || TOPICS[0];
    day.sessions.push(makeSession(date, nextTopic.id, `${Date.now()}`));
    saveState();
    renderCalendar();
    showToast("Nueva charla agregada.");
  }

  async function removeSession(date, sessionId) {
    const day = getActiveSchedule().find(item => item.date === date);
    if (!day || day.sessions.length <= 1) return;
    day.sessions = day.sessions.filter(session => session.id !== sessionId);
    await deleteEvidence(sessionId).catch(() => undefined);
    saveState();
    renderCalendar();
    showToast("Charla eliminada del día.");
  }

  function createDecember() {
    if (!state.schedules["2026-12"]) state.schedules["2026-12"] = buildDecember();
    state.activeMonth = "2026-12";
    saveState();
    renderCalendar();
    showToast("Cronograma de diciembre creado: 27 jornadas de lunes a sábado.");
  }

  function updateNotice() {
    const note = $("#schedule-note");
    if (state.activeMonth === "2026-11") {
      note.innerHTML = `<span class="notice__icon" aria-hidden="true">i</span><div><strong>Programación de noviembre</strong><p>Del lunes 2 al lunes 30, solo de lunes a sábado. Hay 25 jornadas para 26 temas; por ello, el lunes 30 contiene una sesión doble.</p></div>`;
    } else if (state.schedules["2026-12"]) {
      note.innerHTML = `<span class="notice__icon" aria-hidden="true">i</span><div><strong>Programación de diciembre</strong><p>Diciembre tiene 27 jornadas de lunes a sábado. Se programan los 26 temas y el jueves 31 se refuerza el reporte oportuno de incidentes y condiciones subestándares.</p></div>`;
    } else {
      note.innerHTML = `<span class="notice__icon" aria-hidden="true">i</span><div><strong>Diciembre listo para planificar</strong><p>Use el botón “Crear cronograma de diciembre”; luego podrá ajustar cada tema, responsable y evidencia.</p></div>`;
    }
  }

  function renderTopicLibrary() {
    const grid = $("#topic-grid");
    const fragment = document.createDocumentFragment();
    TOPICS.forEach(topic => {
      const article = document.createElement("article");
      article.className = "library-card";
      article.innerHTML = `
        <button class="image-button" type="button" title="Ampliar imagen"><img src="${topic.image}" alt="Ficha visual: ${escapeHtml(topic.title)}" loading="lazy"></button>
        <div><span class="topic-number">Tema ${topic.id}</span><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.objective)}</p><a href="${topic.image}" download="SSOMA-${String(topic.id).padStart(2, "0")}-${slugify(topic.title)}.webp">↓ Descargar imagen</a></div>`;
      $(".image-button", article).addEventListener("click", () => openImageDialog(topic.image, `Tema ${topic.id}: ${topic.title}`));
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
  }

  function slugify(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const rows = [["Fecha", "Día", "N.º de tema", "Tema", "Responsable", "Estado", "Evidencia"]];
    getActiveSchedule().forEach(day => {
      const date = parseLocalDate(day.date);
      day.sessions.forEach(session => {
        const topic = topicById(session.topicId);
        rows.push([
          day.date,
          DAY_NAMES[date.getDay()],
          topic?.id || "",
          topic?.title || "",
          session.responsible,
          session.completed ? "Cumplida" : "Pendiente",
          session.evidence?.originalName || session.evidence?.name || ""
        ]);
      });
    });
    const csv = "\ufeff" + rows.map(row => row.map(csvEscape).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `cronograma-ssoma-${state.activeMonth}.csv`);
    showToast("CSV descargado.");
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function backupJson() {
    try {
      const evidences = await getAllEvidence();
      const serialized = [];
      for (const item of evidences) {
        serialized.push({ ...item, blob: await readBlobAsDataUrl(item.blob) });
      }
      const backup = { format: "ssoma-schedule-backup", version: 1, exportedAt: new Date().toISOString(), state, evidences: serialized };
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `respaldo-ssoma-${new Date().toISOString().slice(0, 10)}.json`);
      showToast("Respaldo descargado con las evidencias.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo generar el respaldo.", true);
    }
  }

  function dataUrlToBlob(dataUrl) {
    const [header, body] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
    const bytes = atob(body);
    const array = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
    return new Blob([array], { type: mime });
  }

  async function importJson(file) {
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "ssoma-schedule-backup" || backup?.version !== 1 || !backup.state?.schedules) throw new Error("Formato no válido");
      await clearEvidence();
      for (const item of backup.evidences || []) {
        await putEvidence({ ...item, blob: dataUrlToBlob(item.blob) });
      }
      state = backup.state;
      saveState();
      renderCalendar();
      showToast("Respaldo importado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("El archivo no es un respaldo SSOMA válido.", true);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    $$(".month-button").forEach(button => button.addEventListener("click", () => {
      state.activeMonth = button.dataset.month;
      saveState();
      renderCalendar();
    }));
    $("#create-december").addEventListener("click", createDecember);
    $$('[data-create-december]').forEach(button => button.addEventListener("click", createDecember));
    $("#search").addEventListener("input", renderCalendar);
    $("#status-filter").addEventListener("change", renderCalendar);
    $("#export-csv").addEventListener("click", exportCsv);
    $("#backup-json").addEventListener("click", backupJson);
    $("#import-json").addEventListener("change", event => {
      const file = event.currentTarget.files?.[0];
      if (file) importJson(file);
      event.currentTarget.value = "";
    });
    $("#dialog-close").addEventListener("click", () => $("#image-dialog").close());
    $("#image-dialog").addEventListener("click", event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
  }

  function init() {
    if (!TOPICS.length) {
      document.body.innerHTML = "<p>No se pudo cargar la biblioteca de temas.</p>";
      return;
    }
    bindEvents();
    renderTopicLibrary();
    renderCalendar();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch(error => console.warn("Service worker no registrado", error));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
