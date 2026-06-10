(function () {
  "use strict";

  var TAGS = {}, PAPERS = [], DATES = [], byDate = {}, latest = null;
  var searchTags = {};
  var STARRED = {};
  var NOTES = {};

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function asDate(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtFull(d) {
    return asDate(d).toLocaleDateString("en-US",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  function fmtShort(d) {
    return asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function plural(n) { return n + (n === 1 ? " paper" : " papers"); }

  function tagPill(slug) {
    var t = TAGS[slug];
    return t ? '<span class="tag" style="--c:' + t.color + '">' + esc(t.name) + "</span>" : "";
  }
  function accent(p) {
    var t = TAGS[(p.tags && p.tags[0]) || ""];
    return t ? t.color : "#94a3b8";
  }
  function authorsLine(a) {
    a = a || [];
    return a.length <= 10
      ? esc(a.join(", "))
      : esc(a.slice(0, 10).join(", ")) + " +" + (a.length - 10);
  }

  // ── persistence ──────────────────────────────────────────────────────────────

  function loadStarred() {
    try {
      var raw = localStorage.getItem("starred-papers");
      if (raw) JSON.parse(raw).forEach(function (id) { STARRED[id] = true; });
    } catch (e) {}
  }
  function saveStarred() {
    try { localStorage.setItem("starred-papers", JSON.stringify(Object.keys(STARRED))); } catch (e) {}
  }

  function loadNotes() {
    try { NOTES = JSON.parse(localStorage.getItem("paper-notes")) || {}; } catch (e) { NOTES = {}; }
  }
  function saveNotes() {
    try { localStorage.setItem("paper-notes", JSON.stringify(NOTES)); } catch (e) {}
  }

  // ── card components ───────────────────────────────────────────────────────────

  var STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  var NOTE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>';

  function starBtn(p) {
    var on = !!STARRED[p.id];
    return '<button class="star-btn' + (on ? " starred" : "") + '" type="button"'
      + ' data-id="' + esc(p.id) + '" aria-pressed="' + String(on) + '"'
      + ' title="' + (on ? "Unstar" : "Star") + ' this paper">'
      + STAR_SVG + "</button>";
  }

  function notesBtn(p) {
    var has = !!(NOTES[p.id] && NOTES[p.id].trim());
    return '<button class="notes-btn' + (has ? " has-note" : "") + '" type="button"'
      + ' data-id="' + esc(p.id) + '" title="' + (has ? "Edit note" : "Add note") + '">'
      + NOTE_SVG + (has ? "<span>Note</span>" : "<span>Note</span>") + "</button>";
  }

  function notesPanel(p) {
    var note = NOTES[p.id] || "";
    return '<div class="notes-panel" hidden>'
      + '<textarea class="notes-input" placeholder="Write your notes about this paper…" rows="3">' + esc(note) + "</textarea>"
      + '<div class="notes-actions">'
      + '<button class="notes-save" data-id="' + esc(p.id) + '">Save</button>'
      + '<button class="notes-discard" data-id="' + esc(p.id) + '">Cancel</button>'
      + "</div></div>";
  }

  function card(p, showDate) {
    var tags = (p.tags || []).map(tagPill).join("");
    return '<article class="card" style="--accent:' + accent(p) + '">'
      + '<div class="card-top">'
      + '<h2><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.title) + "</a></h2>"
      + starBtn(p)
      + "</div>"
      + (p.summary ? '<p class="summary">' + esc(p.summary) + "</p>" : "")
      + (tags ? '<div class="tags">' + tags + "</div>" : "")
      + '<div class="meta">'
        + '<span class="src">' + esc(p.source || "arXiv") + "</span>"
        + (showDate ? '<span class="card-date">' + esc(fmtShort(p.added)) + "</span>" : "")
        + '<span class="authors">' + authorsLine(p.authors) + "</span>"
      + "</div>"
      + '<div class="card-actions">'
        + '<button class="abstract-toggle" aria-expanded="false">Abstract</button>'
        + notesBtn(p)
      + "</div>"
      + '<p class="abstract" hidden>' + esc(p.abstract) + "</p>"
      + notesPanel(p)
      + "</article>";
  }

  function renderGrid(el, list, showDate) {
    el.innerHTML = list.map(function (p) { return card(p, showDate); }).join("");
  }

  // ── views ─────────────────────────────────────────────────────────────────────

  function setTab(view) {
    [].forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.classList.toggle("active", b.dataset.view === view);
    });
  }

  function renderStrip(active) {
    var strip = $("datestrip");
    strip.innerHTML = DATES.map(function (d) {
      return '<button class="date' + (d === active ? " active" : "")
        + '" data-date="' + d + '">' + esc(fmtShort(d)) + "</button>";
    }).join("");
    var act = strip.querySelector(".date.active");
    if (act) act.scrollIntoView({ inline: "center", block: "nearest" });
  }

  function showDaily(date) {
    if (!byDate[date]) date = latest;
    $("search-view").hidden = true;
    $("starred-view").hidden = true;
    $("notes-view").hidden = true;
    $("daily-view").hidden = false;
    setTab("daily");
    renderStrip(date);
    var list = byDate[date] || [];
    $("day-title").textContent = date ? fmtFull(date) : "No papers yet";
    $("day-count").textContent = plural(list.length);
    renderGrid($("daily-grid"), list, false);
    $("daily-empty").hidden = list.length !== 0;
  }

  function renderPills() {
    var box = $("search-pills");
    var none = Object.keys(searchTags).length === 0;
    var html = '<button class="pill' + (none ? " active" : "") + '" data-tag="">All</button>';
    Object.keys(TAGS).forEach(function (slug) {
      var t = TAGS[slug];
      html += '<button class="pill' + (searchTags[slug] ? " active" : "")
        + '" data-tag="' + slug + '" style="--c:' + t.color + '">' + esc(t.name) + "</button>";
    });
    box.innerHTML = html;
  }

  function runSearch() {
    var q = ($("search-input").value || "").trim().toLowerCase();
    var sel = Object.keys(searchTags);
    var list = PAPERS.filter(function (p) {
      var okTag = !sel.length || (p.tags || []).some(function (t) { return searchTags[t]; });
      if (!okTag) return false;
      if (!q) return true;
      var hay = (p.title + " " + (p.authors || []).join(" ")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    $("search-count").textContent = plural(list.length);
    renderGrid($("search-grid"), list, true);
    $("search-empty").hidden = list.length !== 0;
  }

  function showSearch() {
    $("daily-view").hidden = true;
    $("starred-view").hidden = true;
    $("notes-view").hidden = true;
    $("search-view").hidden = false;
    setTab("search");
    renderPills();
    runSearch();
  }

  // ── grouped-section helper used by both starred and notes ─────────────────────

  function groupByTag(papers) {
    var byTag = {}, noTag = [];
    papers.forEach(function (p) {
      var tags = p.tags || [];
      if (!tags.length) { noTag.push(p); return; }
      tags.forEach(function (slug) { (byTag[slug] = byTag[slug] || []).push(p); });
    });
    return { byTag: byTag, noTag: noTag };
  }

  function tagGroupHeader(t, count) {
    return '<div class="section-group-header">'
      + '<span class="section-group-dot" style="background:' + t.color + '"></span>'
      + '<h2 class="section-group-title">' + esc(t.name) + "</h2>"
      + '<span class="count">' + plural(count) + "</span>"
      + "</div>";
  }

  // ── starred view ──────────────────────────────────────────────────────────────

  function showStarred() {
    $("daily-view").hidden = true;
    $("search-view").hidden = true;
    $("notes-view").hidden = true;
    $("starred-view").hidden = false;
    setTab("starred");

    var list = PAPERS.filter(function (p) { return !!STARRED[p.id]; });
    $("starred-count").textContent = plural(list.length);

    if (!list.length) {
      $("starred-groups").innerHTML = "";
      $("starred-empty").hidden = false;
      return;
    }
    $("starred-empty").hidden = true;

    var g = groupByTag(list);
    var html = "";
    Object.keys(TAGS).forEach(function (slug) {
      var group = g.byTag[slug];
      if (!group || !group.length) return;
      html += '<div class="section-group">'
        + tagGroupHeader(TAGS[slug], group.length)
        + '<div class="grid">' + group.map(function (p) { return card(p, true); }).join("") + "</div>"
        + "</div>";
    });
    if (g.noTag.length) {
      html += '<div class="section-group">'
        + '<div class="section-group-header"><span class="section-group-dot" style="background:var(--muted)"></span>'
        + '<h2 class="section-group-title">Untagged</h2><span class="count">' + plural(g.noTag.length) + "</span></div>"
        + '<div class="grid">' + g.noTag.map(function (p) { return card(p, true); }).join("") + "</div>"
        + "</div>";
    }
    $("starred-groups").innerHTML = html;
  }

  // ── notes view ────────────────────────────────────────────────────────────────

  function noteEntry(p) {
    var note = NOTES[p.id] || "";
    var tags = (p.tags || []).map(tagPill).join("");
    return '<div class="note-entry">'
      + '<div class="note-entry-header">'
      + '<a href="' + esc(p.url) + '" target="_blank" rel="noopener" class="note-entry-title">' + esc(p.title) + "</a>"
      + '<span class="note-entry-date">' + esc(fmtShort(p.added)) + "</span>"
      + "</div>"
      + (tags ? '<div class="tags" style="margin:8px 0 0">' + tags + "</div>" : "")
      + '<p class="note-text">' + esc(note) + "</p>"
      + '<div class="note-entry-edit" hidden>'
      + '<textarea class="notes-input" rows="3">' + esc(note) + "</textarea>"
      + '<div class="notes-actions">'
      + '<button class="notes-save" data-id="' + esc(p.id) + '">Save</button>'
      + '<button class="notes-discard" data-id="' + esc(p.id) + '">Cancel</button>'
      + "</div></div>"
      + '<button class="note-edit-btn" data-id="' + esc(p.id) + '">Edit</button>'
      + "</div>";
  }

  function showNotes() {
    $("daily-view").hidden = true;
    $("search-view").hidden = true;
    $("starred-view").hidden = true;
    $("notes-view").hidden = false;
    setTab("notes");

    var list = PAPERS.filter(function (p) { return !!(NOTES[p.id] && NOTES[p.id].trim()); });
    $("notes-count").textContent = plural(list.length);

    if (!list.length) {
      $("notes-groups").innerHTML = "";
      $("notes-empty").hidden = false;
      return;
    }
    $("notes-empty").hidden = true;

    var g = groupByTag(list);
    var html = "";
    Object.keys(TAGS).forEach(function (slug) {
      var group = g.byTag[slug];
      if (!group || !group.length) return;
      html += '<div class="section-group">'
        + tagGroupHeader(TAGS[slug], group.length)
        + '<div class="notes-list">' + group.map(noteEntry).join("") + "</div>"
        + "</div>";
    });
    if (g.noTag.length) {
      html += '<div class="section-group">'
        + '<div class="section-group-header"><span class="section-group-dot" style="background:var(--muted)"></span>'
        + '<h2 class="section-group-title">Untagged</h2><span class="count">' + plural(g.noTag.length) + "</span></div>"
        + '<div class="notes-list">' + g.noTag.map(noteEntry).join("") + "</div>"
        + "</div>";
    }
    $("notes-groups").innerHTML = html;
  }

  // ── routing ───────────────────────────────────────────────────────────────────

  function route() {
    var h = (location.hash || "").replace(/^#/, "");
    if (h === "search") { showSearch(); return; }
    if (h === "starred") { showStarred(); return; }
    if (h === "notes") { showNotes(); return; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(h) && byDate[h]) { showDaily(h); return; }
    showDaily(latest);
  }

  // ── event wiring ─────────────────────────────────────────────────────────────

  function wire() {
    document.addEventListener("click", function (e) {

      // ── tab navigation ──
      var tabEl = e.target.closest(".tab");
      if (tabEl) {
        var v = tabEl.dataset.view;
        if (v === "search") location.hash = "search";
        else if (v === "starred") location.hash = "starred";
        else if (v === "notes") location.hash = "notes";
        else location.hash = latest || "";
        return;
      }

      // ── date strip ──
      var dateEl = e.target.closest(".date");
      if (dateEl) { location.hash = dateEl.dataset.date; return; }

      // ── search pills ──
      var pillEl = e.target.closest(".pill");
      if (pillEl) {
        var slug = pillEl.dataset.tag;
        if (!slug) searchTags = {};
        else if (searchTags[slug]) delete searchTags[slug];
        else searchTags[slug] = true;
        renderPills();
        runSearch();
        return;
      }

      // ── star button ──
      var starEl = e.target.closest(".star-btn");
      if (starEl) {
        var starId = starEl.dataset.id;
        if (STARRED[starId]) delete STARRED[starId]; else STARRED[starId] = true;
        saveStarred();
        [].forEach.call(document.querySelectorAll('.star-btn[data-id="' + starId + '"]'), function (btn) {
          var on = !!STARRED[starId];
          btn.classList.toggle("starred", on);
          btn.setAttribute("aria-pressed", String(on));
          btn.title = on ? "Unstar this paper" : "Star this paper";
        });
        if (!$("starred-view").hidden) showStarred();
        return;
      }

      // ── notes toggle (open/close panel on card) ──
      var notesBtnEl = e.target.closest(".notes-btn");
      if (notesBtnEl) {
        var panel = notesBtnEl.closest(".card").querySelector(".notes-panel");
        panel.hidden = !panel.hidden;
        if (!panel.hidden) panel.querySelector(".notes-input").focus();
        return;
      }

      // ── notes save ──
      var notesSaveEl = e.target.closest(".notes-save");
      if (notesSaveEl) {
        var saveId = notesSaveEl.dataset.id;
        var saveContainer = notesSaveEl.parentNode.parentNode; // .notes-actions → .notes-panel or .note-entry-edit
        var saveText = saveContainer.querySelector(".notes-input").value.trim();

        if (saveText) NOTES[saveId] = saveText; else delete NOTES[saveId];
        saveNotes();

        var inCardPanel = notesSaveEl.closest(".notes-panel");
        if (inCardPanel) {
          inCardPanel.hidden = true;
          // refresh notes-btn state on all rendered cards for this paper
          [].forEach.call(document.querySelectorAll('.notes-btn[data-id="' + saveId + '"]'), function (btn) {
            var has = !!(NOTES[saveId] && NOTES[saveId].trim());
            btn.classList.toggle("has-note", has);
            btn.title = has ? "Edit note" : "Add note";
          });
        } else {
          // inline edit in notes tab: update display without full re-render unless note was deleted
          if (NOTES[saveId]) {
            var entryEl = notesSaveEl.closest(".note-entry");
            entryEl.querySelector(".note-text").textContent = NOTES[saveId];
            entryEl.querySelector(".note-text").hidden = false;
            saveContainer.hidden = true;
            entryEl.querySelector(".note-edit-btn").textContent = "Edit";
          } else {
            showNotes(); // re-render to remove the deleted entry
          }
        }
        if (!$("notes-view").hidden && inCardPanel) showNotes(); // refresh count/grouping
        return;
      }

      // ── notes cancel ──
      var notesDiscardEl = e.target.closest(".notes-discard");
      if (notesDiscardEl) {
        var discardId = notesDiscardEl.dataset.id;
        var inCard = notesDiscardEl.closest(".notes-panel");
        if (inCard) {
          inCard.querySelector(".notes-input").value = NOTES[discardId] || "";
          inCard.hidden = true;
        } else {
          var editEl = notesDiscardEl.closest(".note-entry-edit");
          if (editEl) {
            editEl.querySelector(".notes-input").value = NOTES[discardId] || "";
            editEl.hidden = true;
            editEl.closest(".note-entry").querySelector(".note-text").hidden = false;
            editEl.closest(".note-entry").querySelector(".note-edit-btn").textContent = "Edit";
          }
        }
        return;
      }

      // ── note edit toggle (in notes tab) ──
      var noteEditEl = e.target.closest(".note-edit-btn");
      if (noteEditEl) {
        var editId = noteEditEl.dataset.id;
        var entryEl2 = noteEditEl.closest(".note-entry");
        var textEl = entryEl2.querySelector(".note-text");
        var editArea = entryEl2.querySelector(".note-entry-edit");
        var isEditing = !editArea.hidden;
        if (isEditing) {
          editArea.querySelector(".notes-input").value = NOTES[editId] || "";
          editArea.hidden = true;
          textEl.hidden = false;
          noteEditEl.textContent = "Edit";
        } else {
          textEl.hidden = true;
          editArea.hidden = false;
          editArea.querySelector(".notes-input").focus();
          noteEditEl.textContent = "Cancel";
        }
        return;
      }

      // ── abstract toggle ──
      var togEl = e.target.closest(".abstract-toggle");
      if (togEl) {
        var ab = togEl.closest(".card").querySelector(".abstract");
        var open = !ab.hidden;
        ab.hidden = open;
        togEl.setAttribute("aria-expanded", String(!open));
        togEl.textContent = open ? "Abstract" : "Hide abstract";
        return;
      }
    });

    $("search-input").addEventListener("input", runSearch);
    window.addEventListener("hashchange", route);
  }

  // ── init ──────────────────────────────────────────────────────────────────────

  function init(data) {
    TAGS = data.tags || {};
    PAPERS = data.papers || [];
    byDate = {};
    PAPERS.forEach(function (p) {
      (byDate[p.added] = byDate[p.added] || []).push(p);
    });
    DATES = Object.keys(byDate).sort();
    latest = DATES.length ? DATES[DATES.length - 1] : null;
    loadStarred();
    loadNotes();
    wire();
    route();
  }

  fetch("data.json")
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function (e) {
      document.querySelector("main").innerHTML =
        '<p class="empty">Could not load papers. ' + esc(String(e)) + "</p>";
    });
})();
