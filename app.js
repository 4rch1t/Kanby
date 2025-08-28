(function() {
	"use strict";

	// State
	const LOCAL_STORAGE_KEY = "kanby.v1";
	const LEGACY_KEYS = ["cherrynet.kanban.v1"]; // migrate from these
	/** @typedef {{ id:string, title:string, description:string, priority:'low'|'medium'|'high', due?:string, category?:string, status:'todo'|'inprogress'|'done', order:number }} Task */
	/** @typedef {{ id:string, name:string, createdAt:number, tasks: Task[] }} Board */
	/** @type {{ boards: Board[], activeBoardId: string | null, onboardingSeen: boolean }} */
	let appState = { boards: [], activeBoardId: null, onboardingSeen: false };

	// DOM
	const boardEl = document.getElementById("board");
	const selectBoard = document.getElementById("boardSelect");
	const newBoardBtn = document.getElementById("newBoardBtn");
	const renameBoardBtn = document.getElementById("renameBoardBtn");
	const deleteBoardBtn = document.getElementById("deleteBoardBtn");
	const addTaskBtn = document.getElementById("addTaskBtn");
	const exportBtn = document.getElementById("exportBtn");
	const exportPdfBtn = document.getElementById("exportPdfBtn");
	const exportDropdown = document.getElementById("exportDropdown");
	const exportToggle = document.getElementById("exportToggle");
	const moreDropdown = document.getElementById("moreDropdown");
	const moreToggle = document.getElementById("moreToggle");
	const filtersDropdown = document.getElementById("filtersDropdown");
	const filtersToggle = document.getElementById("filtersToggle");
	const importInput = document.getElementById("importInput");
	const syncBtn = document.getElementById("syncBtn");
	const helpBtn = document.getElementById("helpBtn");

	// Filters
	const searchInput = document.getElementById("searchInput");
	const filterPriority = document.getElementById("filterPriority");
	const filterCategory = document.getElementById("filterCategory");
	const sortBy = document.getElementById("sortBy");

	// Modal elements
	const taskModal = document.getElementById("taskModal");
	const closeTaskModalBtn = document.getElementById("closeTaskModal");
	const taskForm = document.getElementById("taskForm");
	const taskId = document.getElementById("taskId");
	const taskTitle = document.getElementById("taskTitle");
	const taskDescription = document.getElementById("taskDescription");
	const taskPriority = document.getElementById("taskPriority");
	const taskDue = document.getElementById("taskDue");
	const taskCategory = document.getElementById("taskCategory");
	const deleteTaskBtn = document.getElementById("deleteTaskBtn");
	const taskStatusSeed = document.getElementById("taskStatusSeed");

	// Onboarding
	const onboarding = document.getElementById("onboarding");
	const onboardingDismiss = document.getElementById("onboardingDismiss");

	// Helpers
	const uid = () => Math.random().toString(36).slice(2, 10);
	const now = () => Date.now();
	const persist = () => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appState));
	const load = () => {
		try {
			let raw = localStorage.getItem(LOCAL_STORAGE_KEY);
			// migrate from legacy keys if new key is empty
			if (!raw) {
				for (const k of LEGACY_KEYS) { const legacy = localStorage.getItem(k); if (legacy) { raw = legacy; localStorage.setItem(LOCAL_STORAGE_KEY, legacy); break; } }
			}
			if (raw) { appState = JSON.parse(raw); }
		} catch { /* ignore */ }
		if (!appState.boards || appState.boards.length === 0) {
			const defaultBoard = { id: uid(), name: "My Board", createdAt: now(), tasks: [] };
			appState = { boards: [defaultBoard], activeBoardId: defaultBoard.id, onboardingSeen: false };
			persist();
		}
		if (!appState.activeBoardId) {
			appState.activeBoardId = appState.boards[0].id;
		}
	};
	const activeBoard = () => appState.boards.find(b => b.id === appState.activeBoardId);
	function toggleDropdown(root, toggleBtn, open) {
		if (!root || !toggleBtn) return;
		const panel = root.querySelector('.menu-panel');
		if (!panel) return;
		const willOpen = typeof open === 'boolean' ? open : panel.hidden;
		panel.hidden = !willOpen;
		toggleBtn.setAttribute('aria-expanded', String(willOpen));
		if (willOpen) {
			const focusable = panel.querySelector('input,select,button,.import-label');
			if (focusable && focusable.focus) setTimeout(() => focusable.focus(), 0);
		}
	}

	function renderBoardSelector() {
		selectBoard.innerHTML = "";
		for (const b of appState.boards) {
			const opt = document.createElement("option");
			opt.value = b.id; opt.textContent = b.name; if (b.id === appState.activeBoardId) opt.selected = true;
			selectBoard.appendChild(opt);
		}
	}

	function getFilters() {
		return {
			q: (searchInput.value || "").trim().toLowerCase(),
			priority: filterPriority.value,
			category: filterCategory.value,
			sort: sortBy.value
		};
	}

	function sortTasks(tasks, sort) {
		const clone = tasks.slice();
		switch (sort) {
			case "dueAsc": clone.sort((a,b) => (a.due||"").localeCompare(b.due||"")); break;
			case "dueDesc": clone.sort((a,b) => (b.due||"").localeCompare(a.due||"")); break;
			case "priority": {
				const rank = { high: 0, medium: 1, low: 2 };
				clone.sort((a,b) => (rank[a.priority] - rank[b.priority]) || a.title.localeCompare(b.title));
				break;
			}
			case "title": clone.sort((a,b) => a.title.localeCompare(b.title)); break;
			default: clone.sort((a,b) => a.order - b.order);
		}
		return clone;
	}

	function applyFilters(tasks) {
		const f = getFilters();
		let result = tasks;
		if (f.q) {
			result = result.filter(t => t.title.toLowerCase().includes(f.q) || (t.description||"").toLowerCase().includes(f.q));
		}
		if (f.priority) { result = result.filter(t => t.priority === f.priority); }
		if (f.category) { result = result.filter(t => (t.category||"").toLowerCase() === f.category.toLowerCase()); }
		return sortTasks(result, f.sort);
	}

	function collectCategories() {
		const set = new Set();
		for (const b of appState.boards) for (const t of b.tasks) if (t.category) set.add(t.category);
		filterCategory.innerHTML = "<option value=\"\">Category</option>" + Array.from(set).sort().map(c => `<option value="${c}">${c}</option>`).join("");
	}

	// Slight card tilt for sticky note vibe
	function randomTilt() { return (Math.random() * 2 - 1.0) * 1.5; }

	function renderBoard() {
		const board = activeBoard();
		if (!board) return;
		const columns = ["todo","inprogress","done"];
		for (const col of columns) {
			const colEl = boardEl.querySelector(`.column-drop[data-column="${col}"]`);
			colEl.innerHTML = "";
			const tasks = applyFilters(board.tasks.filter(t => t.status === col));
			boardEl.querySelector(`.column[data-column="${col}"] .count`).textContent = `${tasks.length}`;
			for (const t of tasks) {
				const card = renderCard(t);
				card.style.transform = `rotate(${randomTilt()}deg)`;
				colEl.appendChild(card);
			}
		}
	}

	function renderCard(task) {
		const el = document.createElement("article");
		el.className = "card"; el.draggable = true; el.dataset.id = task.id; el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.setAttribute("aria-label", `Edit task ${task.title}`);
		el.innerHTML = `
			<div class="title">${escapeHtml(task.title)}</div>
			<div class="desc">${escapeHtml((task.description||"").slice(0, 160))}</div>
			<div class="meta">
				<span class="badge ${task.priority}">${task.priority}</span>
				${task.due ? `<span class="badge">${task.due}</span>` : ""}
				${task.category ? `<span class="badge">${escapeHtml(task.category)}</span>` : ""}
			</div>
			<div class="actions">
				<button data-action="edit">Edit</button>
			</div>
		`;
		// drag
		el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setTimeout(() => el.classList.add("dragging")); });
		el.addEventListener("dragend", () => { el.classList.remove("dragging"); });
		// open edit via click or keyboard
		el.addEventListener("click", (e) => {
			const target = e.target;
			if (target && (target.getAttribute("data-action") === "edit" || target === el)) { openTaskModal(task); }
		});
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTaskModal(task); }
		});
		
		// Add iOS touch support
		addTouchSupport(el, task);
		
		return el;
	}

	function escapeHtml(s) { return (s||"")
		.replaceAll("&","&amp;")
		.replaceAll("<","&lt;")
		.replaceAll(">","&gt;")
		.replaceAll('"','&quot;')
		.replaceAll("'","&#039;"); }

	// CRUD
	function openTaskModal(task, seedStatus) {
		if (task) {
			taskId.value = task.id;
			taskTitle.value = task.title;
			taskDescription.value = task.description || "";
			taskPriority.value = task.priority;
			taskDue.value = task.due || "";
			taskCategory.value = task.category || "";
			deleteTaskBtn.hidden = false;
			taskStatusSeed.value = task.status;
		} else {
			taskId.value = ""; taskTitle.value = ""; taskDescription.value = ""; taskPriority.value = "medium"; taskDue.value = ""; taskCategory.value = "";
			deleteTaskBtn.hidden = true;
			taskStatusSeed.value = seedStatus || "todo";
		}
		taskModal.hidden = false;
		setTimeout(() => taskTitle.focus(), 0);
	}
	function closeTaskModal() { taskModal.hidden = true; }

	taskForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const id = taskId.value || uid();
		const board = activeBoard(); if (!board) return;
		const existing = board.tasks.find(t => t.id === id);
		const data = {
			id,
			title: taskTitle.value.trim(),
			description: taskDescription.value.trim(),
			priority: /** @type any */ (taskPriority.value || "medium"),
			due: taskDue.value || undefined,
			category: taskCategory.value.trim() || undefined
		};
		if (!data.title) { taskTitle.focus(); return; }
		if (existing) {
			Object.assign(existing, data);
		} else {
			const status = /** @type any */ (taskStatusSeed.value || "todo");
			const maxOrder = Math.max(-1, ...board.tasks.filter(t => t.status === status).map(t => t.order));
			board.tasks.push({ ...data, status, order: maxOrder + 1 });
		}
		persist(); collectCategories(); renderBoard(); closeTaskModal();
	});
	deleteTaskBtn.addEventListener("click", () => {
		const board = activeBoard(); if (!board) return;
		const id = taskId.value; if (!id) return;
		board.tasks = board.tasks.filter(t => t.id !== id);
		persist(); renderBoard(); closeTaskModal();
	});
	closeTaskModalBtn.addEventListener("click", closeTaskModal);
	window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !taskModal.hidden) closeTaskModal(); });
	addTaskBtn.addEventListener("click", () => openTaskModal());

	// Quick add buttons per column
	for (const btn of document.querySelectorAll('.quick-add')) {
		btn.addEventListener('click', () => {
			const status = btn.getAttribute('data-target');
			openTaskModal(undefined, status);
		});
	}
	// Double-click on column body to quick add
	for (const drop of document.querySelectorAll('.column-drop')) {
		drop.addEventListener('dblclick', () => {
			const status = drop.getAttribute('data-column');
			openTaskModal(undefined, status);
		});
	}

	// Drag & drop
	for (const drop of document.querySelectorAll(".column-drop")) {
		drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); e.dataTransfer.dropEffect = "move"; });
		drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
		drop.addEventListener("drop", (e) => {
			e.preventDefault(); drop.classList.remove("drag-over");
			const id = e.dataTransfer.getData("text/plain");
			const board = activeBoard(); if (!board) return;
			const task = board.tasks.find(t => t.id === id); if (!task) return;
			const newStatus = drop.getAttribute("data-column");
			const columnTasks = board.tasks.filter(t => t.status === newStatus && t.id !== id);
			const maxOrder = Math.max(-1, ...columnTasks.map(t => t.order));
			task.status = /** @type any */(newStatus);
			task.order = maxOrder + 1;
			persist(); renderBoard();
		});
	}

	// iOS Touch Support for Drag & Drop
	let touchStartY = 0;
	let touchStartX = 0;
	let currentTouchTask = null;
	let touchScrollTimeout = null;

	// Add touch events to task cards
	function addTouchSupport(taskElement, task) {
		taskElement.addEventListener('touchstart', (e) => {
			e.preventDefault();
			touchStartY = e.touches[0].clientY;
			touchStartX = e.touches[0].clientX;
			currentTouchTask = task;
			
			// Add visual feedback
			taskElement.classList.add('touch-active');
			
			// Prevent scrolling during touch
			clearTimeout(touchScrollTimeout);
		}, { passive: false });

		taskElement.addEventListener('touchmove', (e) => {
			if (!currentTouchTask) return;
			
			const touchY = e.touches[0].clientY;
			const touchX = e.touches[0].clientX;
			const deltaY = Math.abs(touchY - touchStartY);
			const deltaX = Math.abs(touchX - touchStartX);
			
			// If significant movement, prevent scrolling
			if (deltaY > 10 || deltaX > 10) {
				e.preventDefault();
			}
		}, { passive: false });

		taskElement.addEventListener('touchend', (e) => {
			if (!currentTouchTask) return;
			
			const touchY = e.changedTouches[0].clientY;
			const touchX = e.changedTouches[0].clientX;
			const deltaY = Math.abs(touchY - touchStartY);
			const deltaX = Math.abs(touchX - touchStartX);
			
			// Remove visual feedback
			taskElement.classList.remove('touch-active');
			
			// If minimal movement, treat as click
			if (deltaY < 10 && deltaX < 10) {
				openTaskModal(currentTouchTask);
				currentTouchTask = null;
				return;
			}
			
			// Find the column under the touch point
			const elementBelow = document.elementFromPoint(touchX, touchY);
			const columnDrop = elementBelow?.closest('.column-drop');
			
			if (columnDrop && currentTouchTask) {
				const newStatus = columnDrop.getAttribute("data-column");
				const board = activeBoard();
				if (board && newStatus && newStatus !== currentTouchTask.status) {
					// Move the task
					const columnTasks = board.tasks.filter(t => t.status === newStatus && t.id !== currentTouchTask.id);
					const maxOrder = Math.max(-1, ...columnTasks.map(t => t.order));
					currentTouchTask.status = newStatus;
					currentTouchTask.order = maxOrder + 1;
					persist();
					renderBoard();
				}
			}
			
			currentTouchTask = null;
		});
	}

	// Filtering/sorting
	for (const el of [searchInput, filterPriority, filterCategory, sortBy]) {
		el.addEventListener("input", () => renderBoard());
	}

	// Boards management
	selectBoard.addEventListener("change", () => { appState.activeBoardId = selectBoard.value; persist(); renderBoard(); });
	newBoardBtn.addEventListener("click", () => {
		const name = prompt("Board name?", "New Board"); if (!name) return;
		const b = { id: uid(), name: name.trim(), createdAt: now(), tasks: [] };
		appState.boards.push(b); appState.activeBoardId = b.id; persist(); renderBoardSelector(); collectCategories(); renderBoard();
	});
	renameBoardBtn.addEventListener("click", () => {
		const board = activeBoard(); if (!board) return;
		const name = prompt("Rename board", board.name); if (!name) return;
		board.name = name.trim(); persist(); renderBoardSelector();
	});
	deleteBoardBtn.addEventListener("click", () => {
		const board = activeBoard(); if (!board) return;
		if (!confirm(`Delete board "${board.name}"? This cannot be undone.`)) return;
		appState.boards = appState.boards.filter(b => b.id !== board.id);
		if (appState.boards.length === 0) {
			const b = { id: uid(), name: "My Board", createdAt: now(), tasks: [] };
			appState.boards.push(b); appState.activeBoardId = b.id;
		} else {
			appState.activeBoardId = appState.boards[0].id;
		}
		persist(); renderBoardSelector(); collectCategories(); renderBoard();
	});

	// Export JSON
	exportBtn.addEventListener("click", () => {
		const data = JSON.stringify(appState, null, 2);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a"); a.href = url; a.download = `kanby-${new Date().toISOString().slice(0,10)}.json`; a.click();
		URL.revokeObjectURL(url);
	});
	// Export PDF (print 3 pages via CSS)
	exportPdfBtn.addEventListener("click", () => {
		window.print();
	});

	// Import
	importInput.addEventListener("change", async () => {
		const file = importInput.files && importInput.files[0]; if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			if (!data || !Array.isArray(data.boards)) throw new Error("Invalid file");
			appState = data; persist(); renderBoardSelector(); collectCategories(); renderBoard();
			alert("Import complete");
		} catch (err) {
			alert("Import failed: " + (err && err.message ? err.message : err));
		}
		importInput.value = "";
	});

	// Cloud sync stub
	syncBtn.addEventListener("click", async () => {
		alert("Cloud sync is a stub. Hook up your backend API here.");
	});

	// Help / onboarding
	helpBtn.addEventListener("click", () => { onboarding.hidden = false; });
	onboardingDismiss.addEventListener("click", () => { onboarding.hidden = true; appState.onboardingSeen = true; persist(); });

	// Shortcuts: n for new task, / to search
	window.addEventListener("keydown", (e) => {
		const t = /** @type any */ (e.target);
		const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
		if (isTyping) return;
		if (!taskModal.hidden) return;
		if (e.key === "/") { e.preventDefault(); searchInput.focus(); }
		if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault(); openTaskModal();
		}
	});

	// Toggle handlers
	if (moreToggle) moreToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(moreDropdown, moreToggle); toggleDropdown(filtersDropdown, filtersToggle, false); toggleDropdown(exportDropdown, exportToggle, false); });
	if (filtersToggle) filtersToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(filtersDropdown, filtersToggle); toggleDropdown(moreDropdown, moreToggle, false); toggleDropdown(exportDropdown, exportToggle, false); });
	if (exportToggle) exportToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(exportDropdown, exportToggle); toggleDropdown(filtersDropdown, filtersToggle, false); toggleDropdown(moreDropdown, moreToggle, false); });
	// Click outside closes
	document.addEventListener('click', () => { if (moreDropdown) toggleDropdown(moreDropdown, moreToggle, false); if (filtersDropdown) toggleDropdown(filtersDropdown, filtersToggle, false); if (exportDropdown) toggleDropdown(exportDropdown, exportToggle, false); });
	// Escape closes
	window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (moreDropdown) toggleDropdown(moreDropdown, moreToggle, false); if (filtersDropdown) toggleDropdown(filtersDropdown, filtersToggle, false); if (exportDropdown) toggleDropdown(exportDropdown, exportToggle, false); } });

	// prevent closing when clicking inside panels
	for (const panel of document.querySelectorAll('.menu-panel')) { panel.addEventListener('click', (e) => e.stopPropagation()); }

	// Init
	load();
	renderBoardSelector();
	collectCategories();
	renderBoard();
	if (!appState.onboardingSeen) onboarding.hidden = false;
})(); 