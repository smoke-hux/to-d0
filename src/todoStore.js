export const STORAGE_KEY = "to-d0.tasks.v1";
export const PRIORITIES = ["low", "medium", "high"];
export const STATUS_FILTERS = ["all", "active", "completed", "overdue"];

const PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2
};

export function getTodayIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizePriority(priority) {
  return PRIORITIES.includes(priority) ? priority : "medium";
}

export function createTask(input, now = new Date()) {
  const title = normalizeText(input?.title);

  if (!title) {
    throw new Error("Task title is required");
  }

  const timestamp = now.toISOString();

  return {
    id: input?.id || createId(),
    title,
    notes: normalizeText(input?.notes),
    priority: normalizePriority(input?.priority),
    dueDate: normalizeDate(input?.dueDate),
    completed: Boolean(input?.completed),
    createdAt: input?.createdAt || timestamp,
    updatedAt: input?.updatedAt || timestamp
  };
}

export function addTask(tasks, input, now = new Date()) {
  return [createTask(input, now), ...tasks];
}

export function toggleTask(tasks, id, now = new Date()) {
  return tasks.map((task) =>
    task.id === id
      ? {
          ...task,
          completed: !task.completed,
          updatedAt: now.toISOString()
        }
      : task
  );
}

export function updateTask(tasks, id, changes, now = new Date()) {
  return tasks.map((task) => {
    if (task.id !== id) {
      return task;
    }

    const title = normalizeText(changes.title ?? task.title);

    if (!title) {
      throw new Error("Task title is required");
    }

    return {
      ...task,
      title,
      notes: normalizeText(changes.notes ?? task.notes),
      priority: normalizePriority(changes.priority ?? task.priority),
      dueDate: normalizeDate(changes.dueDate ?? task.dueDate),
      updatedAt: now.toISOString()
    };
  });
}

export function deleteTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}

export function clearCompleted(tasks) {
  return tasks.filter((task) => !task.completed);
}

export function isOverdue(task, today = getTodayIso()) {
  return Boolean(task.dueDate && task.dueDate < today && !task.completed);
}

export function getStats(tasks, today = getTodayIso()) {
  const completed = tasks.filter((task) => task.completed).length;

  return {
    total: tasks.length,
    active: tasks.length - completed,
    completed,
    overdue: tasks.filter((task) => isOverdue(task, today)).length
  };
}

export function getVisibleTasks(tasks, filters = {}, today = getTodayIso()) {
  const status = STATUS_FILTERS.includes(filters.status) ? filters.status : "all";
  const rawPriority = filters.priority || "all";
  const priority = rawPriority === "all" ? "all" : normalizePriority(rawPriority);
  const search = normalizeText(filters.search).toLowerCase();

  return sortTasks(
    tasks.filter((task) => {
      const matchesStatus =
        status === "all" ||
        (status === "active" && !task.completed) ||
        (status === "completed" && task.completed) ||
        (status === "overdue" && isOverdue(task, today));
      const matchesPriority = priority === "all" || task.priority === priority;
      const searchableText = `${task.title} ${task.notes}`.toLowerCase();
      const matchesSearch = !search || searchableText.includes(search);

      return matchesStatus && matchesPriority && matchesSearch;
    })
  );
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const completedOrder = Number(a.completed) - Number(b.completed);

    if (completedOrder !== 0) {
      return completedOrder;
    }

    const dueOrder = normalizeSortDate(a.dueDate).localeCompare(normalizeSortDate(b.dueDate));

    if (dueOrder !== 0) {
      return dueOrder;
    }

    const priorityOrder = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function loadTasks(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((task) => normalizeStoredTask(task)).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveTasks(tasks, storage = globalThis.localStorage) {
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  return tasks;
}

function normalizeStoredTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }

  try {
    return createTask(
      {
        id: task.id,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        dueDate: task.dueDate,
        completed: task.completed,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      },
      new Date(task.createdAt || Date.now())
    );
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeDate(value) {
  const date = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeSortDate(value) {
  return value || "9999-12-31";
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
