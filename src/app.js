import {
  addTask,
  clearCompleted,
  deleteTask,
  getStats,
  getTodayIso,
  getVisibleTasks,
  loadTasks,
  saveTasks,
  toggleTask,
  updateTask
} from "./todoStore.js";

const state = {
  tasks: loadTasks(),
  filters: {
    status: "all",
    priority: "all",
    search: ""
  },
  editingId: null
};

const elements = {
  form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"),
  priority: document.querySelector("#task-priority"),
  dueDate: document.querySelector("#task-due-date"),
  notes: document.querySelector("#task-notes"),
  list: document.querySelector("#task-list"),
  emptyState: document.querySelector("#empty-state"),
  search: document.querySelector("#task-search"),
  priorityFilter: document.querySelector("#priority-filter"),
  clearCompleted: document.querySelector("#clear-completed"),
  filterButtons: [...document.querySelectorAll(".filter-button")],
  stats: {
    total: document.querySelector("#stat-total"),
    active: document.querySelector("#stat-active"),
    overdue: document.querySelector("#stat-overdue"),
    completed: document.querySelector("#stat-completed")
  },
  meterRing: document.querySelector("#meter-ring"),
  meterCopy: document.querySelector("#meter-copy")
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    state.tasks = addTask(state.tasks, readCreateForm());
    persistAndRender();
    elements.form.reset();
    elements.priority.value = "medium";
    elements.title.focus();
  } catch (error) {
    elements.title.setCustomValidity(error.message);
    elements.title.reportValidity();
    elements.title.addEventListener("input", () => elements.title.setCustomValidity(""), {
      once: true
    });
  }
});

elements.search.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  render();
});

elements.priorityFilter.addEventListener("change", (event) => {
  state.filters.priority = event.target.value;
  render();
});

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filters.status = button.dataset.status;
    elements.filterButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  });
});

elements.clearCompleted.addEventListener("click", () => {
  state.tasks = clearCompleted(state.tasks);
  state.editingId = null;
  persistAndRender();
});

elements.list.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-action='toggle']");

  if (!checkbox) {
    return;
  }

  state.tasks = toggleTask(state.tasks, checkbox.closest("[data-task-id]").dataset.taskId);
  persistAndRender();
});

elements.list.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");

  if (!action) {
    return;
  }

  const taskId = action.closest("[data-task-id]")?.dataset.taskId;

  if (!taskId) {
    return;
  }

  if (action.dataset.action === "delete") {
    state.tasks = deleteTask(state.tasks, taskId);
    state.editingId = null;
    persistAndRender();
  }

  if (action.dataset.action === "edit") {
    state.editingId = taskId;
    render();
    document.querySelector(`[data-task-id="${cssEscape(taskId)}"] input[name="title"]`)?.focus();
  }

  if (action.dataset.action === "cancel") {
    state.editingId = null;
    render();
  }
});

elements.list.addEventListener("submit", (event) => {
  event.preventDefault();

  const form = event.target.closest(".edit-form");

  if (!form) {
    return;
  }

  const taskId = form.closest("[data-task-id]").dataset.taskId;
  const formData = new FormData(form);

  try {
    state.tasks = updateTask(state.tasks, taskId, {
      title: formData.get("title"),
      notes: formData.get("notes"),
      priority: formData.get("priority"),
      dueDate: formData.get("dueDate")
    });
    state.editingId = null;
    persistAndRender();
  } catch (error) {
    const titleInput = form.querySelector("input[name='title']");
    titleInput.setCustomValidity(error.message);
    titleInput.reportValidity();
    titleInput.addEventListener("input", () => titleInput.setCustomValidity(""), { once: true });
  }
});

render();

function readCreateForm() {
  return {
    title: elements.title.value,
    priority: elements.priority.value,
    dueDate: elements.dueDate.value,
    notes: elements.notes.value
  };
}

function persistAndRender() {
  saveTasks(state.tasks);
  render();
}

function render() {
  const today = getTodayIso();
  const stats = getStats(state.tasks, today);
  const visibleTasks = getVisibleTasks(state.tasks, state.filters, today);

  elements.stats.total.textContent = stats.total;
  elements.stats.active.textContent = stats.active;
  elements.stats.overdue.textContent = stats.overdue;
  elements.stats.completed.textContent = stats.completed;

  const completion = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
  elements.meterCopy.textContent = `${completion}%`;
  elements.meterRing.style.setProperty("--meter-value", `${completion}%`);
  elements.clearCompleted.disabled = stats.completed === 0;

  elements.emptyState.hidden = visibleTasks.length > 0;
  elements.list.innerHTML = visibleTasks
    .map((task) => (state.editingId === task.id ? renderEditTask(task) : renderTask(task, today)))
    .join("");
}

function renderTask(task, today) {
  const dueState = getDueState(task, today);
  const notesMarkup = task.notes
    ? `<p class="task-notes">${escapeHtml(task.notes)}</p>`
    : "";

  return `
    <li class="task-item ${task.completed ? "is-complete" : ""}" data-task-id="${escapeHtml(
      task.id
    )}">
      <label class="task-check">
        <input data-action="toggle" type="checkbox" ${task.completed ? "checked" : ""} />
        <span class="check-icon" aria-hidden="true"></span>
        <span class="sr-only">${task.completed ? "Mark active" : "Mark complete"}</span>
      </label>
      <div class="task-content">
        <h2>${escapeHtml(task.title)}</h2>
        ${notesMarkup}
        <div class="task-meta">
          <span class="priority-chip priority-${task.priority}">${capitalize(task.priority)}</span>
          <span class="due-chip ${dueState.className}">
            <span class="icon" aria-hidden="true" data-icon="calendar"></span>
            ${dueState.label}
          </span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-button" type="button" data-action="edit" aria-label="Edit task">
          <span class="icon" aria-hidden="true" data-icon="edit"></span>
        </button>
        <button class="icon-button danger" type="button" data-action="delete" aria-label="Delete task">
          <span class="icon" aria-hidden="true" data-icon="trash"></span>
        </button>
      </div>
    </li>
  `;
}

function renderEditTask(task) {
  return `
    <li class="task-item edit-item" data-task-id="${escapeHtml(task.id)}">
      <form class="edit-form">
        <label class="field title-field">
          <span>Task</span>
          <input name="title" type="text" maxlength="120" required value="${escapeHtml(
            task.title
          )}" />
        </label>
        <label class="field">
          <span>Priority</span>
          <select name="priority">
            ${["high", "medium", "low"]
              .map(
                (priority) =>
                  `<option value="${priority}" ${
                    task.priority === priority ? "selected" : ""
                  }>${capitalize(priority)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Due</span>
          <input name="dueDate" type="date" value="${escapeHtml(task.dueDate)}" />
        </label>
        <label class="field notes-field">
          <span>Notes</span>
          <textarea name="notes" maxlength="280" rows="2">${escapeHtml(task.notes)}</textarea>
        </label>
        <div class="edit-actions">
          <button class="primary-action compact" type="submit">
            <span class="icon" aria-hidden="true" data-icon="check"></span>
            <span>Save</span>
          </button>
          <button class="ghost-action compact" type="button" data-action="cancel">
            <span class="icon" aria-hidden="true" data-icon="x"></span>
            <span>Cancel</span>
          </button>
        </div>
      </form>
    </li>
  `;
}

function getDueState(task, today) {
  if (!task.dueDate) {
    return {
      className: "due-none",
      label: "No due date"
    };
  }

  if (task.dueDate < today && !task.completed) {
    return {
      className: "due-overdue",
      label: `Overdue ${formatDate(task.dueDate)}`
    };
  }

  if (task.dueDate === today && !task.completed) {
    return {
      className: "due-today",
      label: "Due today"
    };
  }

  return {
    className: "due-upcoming",
    label: formatDate(task.dueDate)
  };
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}
