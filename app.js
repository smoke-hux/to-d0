const STORAGE_KEY = "to-d0.tasks.v1";
const VALID_PRIORITIES = ["high", "normal", "low"];
const PRIORITY_ORDER = {
  high: 0,
  normal: 1,
  low: 2,
};

const state = {
  tasks: loadTasks(),
  filter: "all",
  search: "",
  sort: "created",
};

const elements = {
  form: document.querySelector("#taskForm"),
  title: document.querySelector("#taskTitle"),
  priority: document.querySelector("#taskPriority"),
  dueDate: document.querySelector("#taskDueDate"),
  formError: document.querySelector("#formError"),
  todayLabel: document.querySelector("#todayLabel"),
  list: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  emptyStateTitle: document.querySelector("#emptyStateTitle"),
  emptyStateCopy: document.querySelector("#emptyStateCopy"),
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  completedCount: document.querySelector("#completedCount"),
  dueTodayCount: document.querySelector("#dueTodayCount"),
  clearCompleted: document.querySelector("#clearCompleted"),
  search: document.querySelector("#taskSearch"),
  sort: document.querySelector("#taskSort"),
  filters: Array.from(document.querySelectorAll("[data-filter]")),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editTaskId: document.querySelector("#editTaskId"),
  editTaskTitle: document.querySelector("#editTaskTitle"),
  editTaskPriority: document.querySelector("#editTaskPriority"),
  editTaskDueDate: document.querySelector("#editTaskDueDate"),
  editError: document.querySelector("#editError"),
  closeEditDialog: document.querySelector("#closeEditDialog"),
  cancelEdit: document.querySelector("#cancelEdit"),
  statusMessage: document.querySelector("#statusMessage"),
};

elements.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
}).format(new Date());

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = elements.title.value.trim();
  if (!title) {
    elements.formError.textContent = "Enter a task before adding it.";
    elements.title.focus();
    return;
  }

  state.tasks.unshift({
    id: createTaskId(),
    title,
    priority: normalizePriority(elements.priority.value),
    dueDate: normalizeDueDate(elements.dueDate.value),
    completed: false,
    createdAt: new Date().toISOString(),
  });

  elements.form.reset();
  elements.priority.value = "normal";
  elements.formError.textContent = "";
  saveTasks();
  render();
  announce("Task added.");
});

elements.search.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  render();
});

elements.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

elements.filters.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    elements.filters.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-selected", String(isActive));
    });
    render();
  });
});

elements.clearCompleted.addEventListener("click", () => {
  const completedCount = state.tasks.filter((task) => task.completed).length;
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  render();
  announce(`${completedCount} ${pluralize("task", completedCount)} cleared.`);
});

elements.list.addEventListener("change", (event) => {
  if (!event.target.matches("[data-action='toggle']")) {
    return;
  }

  const task = getTask(event.target.closest("[data-id]")?.dataset.id);
  if (!task) {
    return;
  }

  task.completed = event.target.checked;
  saveTasks();
  render();
  announce(task.completed ? "Task completed." : "Task marked active.");
});

elements.list.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton || actionButton.dataset.action === "toggle") {
    return;
  }

  const taskId = actionButton.closest("[data-id]")?.dataset.id;
  const task = getTask(taskId);
  if (!task) {
    return;
  }

  if (actionButton.dataset.action === "delete") {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    saveTasks();
    render();
    announce("Task deleted.");
    return;
  }

  if (actionButton.dataset.action === "edit") {
    openEditDialog(task);
  }
});

elements.editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveTaskEdits();
});

elements.closeEditDialog.addEventListener("click", closeEditDialog);
elements.cancelEdit.addEventListener("click", closeEditDialog);
elements.editDialog.addEventListener("cancel", resetEditForm);

render();

function render() {
  const visibleTasks = getVisibleTasks();
  const completedCount = state.tasks.filter((task) => task.completed).length;
  const activeCount = state.tasks.length - completedCount;
  const dueTodayCount = state.tasks.filter(
    (task) => !task.completed && task.dueDate === getToday(),
  ).length;

  elements.totalCount.textContent = state.tasks.length;
  elements.activeCount.textContent = activeCount;
  elements.completedCount.textContent = completedCount;
  elements.dueTodayCount.textContent = dueTodayCount;
  elements.clearCompleted.disabled = completedCount === 0;
  elements.emptyState.hidden = visibleTasks.length > 0;
  updateEmptyState();
  elements.list.replaceChildren(...visibleTasks.map(createTaskElement));
}

function getVisibleTasks() {
  const filteredTasks = state.tasks.filter((task) => {
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "active" && !task.completed) ||
      (state.filter === "completed" && task.completed);
    const matchesSearch = !state.search || task.title.toLowerCase().includes(state.search);
    return matchesFilter && matchesSearch;
  });

  return sortTasks(filteredTasks);
}

function sortTasks(tasks) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (state.sort === "priority") {
      return (
        comparePriority(firstTask, secondTask) ||
        compareDueDate(firstTask, secondTask) ||
        compareNewestFirst(firstTask, secondTask)
      );
    }

    if (state.sort === "due") {
      return (
        compareDueDate(firstTask, secondTask) ||
        comparePriority(firstTask, secondTask) ||
        compareNewestFirst(firstTask, secondTask)
      );
    }

    return compareNewestFirst(firstTask, secondTask);
  });
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-card${task.completed ? " is-complete" : ""}`;
  item.dataset.id = task.id;
  item.dataset.priority = task.priority;

  const checkbox = document.createElement("input");
  checkbox.className = "task-check";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.action = "toggle";
  checkbox.setAttribute(
    "aria-label",
    task.completed ? `Mark ${task.title} as active` : `Mark ${task.title} as complete`,
  );

  const content = document.createElement("div");
  content.className = "task-content";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(createPriorityBadge(task.priority));
  if (task.dueDate) {
    meta.append(createDueDateBadge(task.dueDate, task.completed));
  }

  content.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    createIconButton("edit", "Edit task", editIcon()),
    createIconButton("delete", "Delete task", deleteIcon()),
  );

  item.append(checkbox, content, actions);
  return item;
}

function createPriorityBadge(priority) {
  const badge = document.createElement("span");
  badge.className = `badge is-${priority}`;
  badge.textContent = `${capitalize(priority)} priority`;
  return badge;
}

function createDueDateBadge(dueDate, completed) {
  const badge = document.createElement("span");
  const overdue = !completed && dueDate < getToday();
  badge.className = `badge${overdue ? " is-overdue" : ""}`;
  badge.textContent = `${overdue ? "Overdue" : "Due"} ${formatDate(dueDate)}`;
  return badge;
}

function createIconButton(action, label, iconMarkup) {
  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.dataset.action = action;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = `${iconMarkup}<span class="sr-only">${label}</span>`;
  return button;
}

function openEditDialog(task) {
  if (typeof elements.editDialog.showModal !== "function") {
    editTaskWithPrompt(task);
    return;
  }

  elements.editTaskId.value = task.id;
  elements.editTaskTitle.value = task.title;
  elements.editTaskPriority.value = task.priority;
  elements.editTaskDueDate.value = task.dueDate;
  elements.editError.textContent = "";
  elements.editDialog.showModal();
  elements.editTaskTitle.focus();
  elements.editTaskTitle.select();
}

function saveTaskEdits() {
  const task = getTask(elements.editTaskId.value);
  if (!task) {
    closeEditDialog();
    return;
  }

  const title = elements.editTaskTitle.value.trim();
  if (!title) {
    elements.editError.textContent = "Task names cannot be empty.";
    elements.editTaskTitle.focus();
    return;
  }

  task.title = title;
  task.priority = normalizePriority(elements.editTaskPriority.value);
  task.dueDate = normalizeDueDate(elements.editTaskDueDate.value);
  elements.editError.textContent = "";
  saveTasks();
  render();
  closeEditDialog();
  announce("Task updated.");
}

function closeEditDialog() {
  resetEditForm();
  if (elements.editDialog.open) {
    elements.editDialog.close();
  }
}

function resetEditForm() {
  elements.editForm.reset();
  elements.editError.textContent = "";
  elements.editTaskId.value = "";
}

function editTaskWithPrompt(task) {
  const nextTitle = window.prompt("Edit task", task.title);
  if (nextTitle === null) {
    return;
  }

  const trimmedTitle = nextTitle.trim();
  if (!trimmedTitle) {
    elements.formError.textContent = "Task names cannot be empty.";
    return;
  }

  task.title = trimmedTitle;
  elements.formError.textContent = "";
  saveTasks();
  render();
  announce("Task updated.");
}

function updateEmptyState() {
  if (state.tasks.length === 0) {
    elements.emptyStateTitle.textContent = "No tasks yet";
    elements.emptyStateCopy.textContent = "Add the first task to start tracking the list.";
    return;
  }

  if (state.search) {
    elements.emptyStateTitle.textContent = "No search results";
    elements.emptyStateCopy.textContent = "Try a different search term.";
    return;
  }

  elements.emptyStateTitle.textContent = `No ${state.filter} tasks`;
  elements.emptyStateCopy.textContent = "Switch filters or add another task.";
}

function getTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function createTaskId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(savedTasks) ? savedTasks.map(normalizeTask).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function normalizeTask(task) {
  const id = typeof task?.id === "string" ? task.id.trim() : "";
  const title = typeof task?.title === "string" ? task.title.trim() : "";

  if (!id || !title || typeof task?.completed !== "boolean") {
    return null;
  }

  return {
    id,
    title,
    priority: normalizePriority(task.priority),
    dueDate: normalizeDueDate(task.dueDate),
    completed: task.completed,
    createdAt: normalizeCreatedAt(task.createdAt),
  };
}

function normalizePriority(priority) {
  return VALID_PRIORITIES.includes(priority) ? priority : "normal";
}

function normalizeDueDate(dueDate) {
  return isValidDueDate(dueDate) ? dueDate : "";
}

function normalizeCreatedAt(createdAt) {
  return typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt))
    ? createdAt
    : new Date(0).toISOString();
}

function isValidDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function comparePriority(firstTask, secondTask) {
  return PRIORITY_ORDER[firstTask.priority] - PRIORITY_ORDER[secondTask.priority];
}

function compareDueDate(firstTask, secondTask) {
  if (!firstTask.dueDate && !secondTask.dueDate) {
    return 0;
  }

  if (!firstTask.dueDate) {
    return 1;
  }

  if (!secondTask.dueDate) {
    return -1;
  }

  return firstTask.dueDate.localeCompare(secondTask.dueDate);
}

function compareNewestFirst(firstTask, secondTask) {
  return Date.parse(secondTask.createdAt) - Date.parse(firstTask.createdAt);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

function announce(message) {
  elements.statusMessage.textContent = "";
  window.setTimeout(() => {
    elements.statusMessage.textContent = message;
  }, 0);
}

function editIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L17.5 5.5a2.1 2.1 0 0 0-3 0L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
      <path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function deleteIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M9 7V5h6v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M8 10v9h8v-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}
