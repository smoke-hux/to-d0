const STORAGE_KEY = "to-d0.tasks.v1";

const state = {
  tasks: loadTasks(),
  filter: "all",
  search: "",
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
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  completedCount: document.querySelector("#completedCount"),
  clearCompleted: document.querySelector("#clearCompleted"),
  search: document.querySelector("#taskSearch"),
  filters: Array.from(document.querySelectorAll("[data-filter]")),
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
    priority: elements.priority.value,
    dueDate: elements.dueDate.value,
    completed: false,
    createdAt: new Date().toISOString(),
  });

  elements.form.reset();
  elements.priority.value = "normal";
  elements.formError.textContent = "";
  saveTasks();
  render();
});

elements.search.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
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
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  render();
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
    return;
  }

  if (actionButton.dataset.action === "edit") {
    editTask(task);
  }
});

render();

function render() {
  const visibleTasks = getVisibleTasks();
  const completedCount = state.tasks.filter((task) => task.completed).length;
  const activeCount = state.tasks.length - completedCount;

  elements.totalCount.textContent = state.tasks.length;
  elements.activeCount.textContent = activeCount;
  elements.completedCount.textContent = completedCount;
  elements.clearCompleted.disabled = completedCount === 0;
  elements.emptyState.hidden = visibleTasks.length > 0;
  elements.list.replaceChildren(...visibleTasks.map(createTaskElement));
}

function getVisibleTasks() {
  return state.tasks.filter((task) => {
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "active" && !task.completed) ||
      (state.filter === "completed" && task.completed);
    const matchesSearch = !state.search || task.title.toLowerCase().includes(state.search);
    return matchesFilter && matchesSearch;
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
  checkbox.setAttribute("aria-label", `Mark ${task.title} as complete`);

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

function editTask(task) {
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
    return Array.isArray(savedTasks) ? savedTasks.filter(isValidTask) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean"
  );
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
  return new Date().toISOString().slice(0, 10);
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
