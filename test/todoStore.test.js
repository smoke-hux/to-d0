import assert from "node:assert/strict";
import test from "node:test";

import {
  addTask,
  clearCompleted,
  createTask,
  deleteTask,
  getStats,
  getVisibleTasks,
  loadTasks,
  saveTasks,
  toggleTask,
  updateTask
} from "../src/todoStore.js";

const NOW = new Date("2026-08-04T12:00:00.000Z");

test("createTask normalizes fields and requires a title", () => {
  const task = createTask(
    {
      id: "task-1",
      title: "  Ship   todo app  ",
      notes: " Add local persistence ",
      priority: "urgent",
      dueDate: "2026-08-05"
    },
    NOW
  );

  assert.equal(task.title, "Ship todo app");
  assert.equal(task.notes, "Add local persistence");
  assert.equal(task.priority, "medium");
  assert.equal(task.dueDate, "2026-08-05");
  assert.equal(task.completed, false);
  assert.equal(task.createdAt, NOW.toISOString());
  assert.throws(() => createTask({ title: " " }, NOW), /required/);
});

test("task mutations are immutable and scoped by id", () => {
  const tasks = [
    createTask({ id: "a", title: "First", priority: "high" }, NOW),
    createTask({ id: "b", title: "Second", priority: "low" }, NOW)
  ];

  const toggled = toggleTask(tasks, "a", new Date("2026-08-04T13:00:00.000Z"));
  const updated = updateTask(toggled, "b", { title: "Updated", dueDate: "2026-08-08" }, NOW);
  const deleted = deleteTask(updated, "a");

  assert.equal(tasks[0].completed, false);
  assert.equal(toggled[0].completed, true);
  assert.equal(updated[1].title, "Updated");
  assert.deepEqual(deleted.map((task) => task.id), ["b"]);
});

test("filters include status, priority, and search", () => {
  const tasks = [
    createTask(
      {
        id: "overdue",
        title: "Submit invoice",
        priority: "high",
        dueDate: "2026-08-01"
      },
      NOW
    ),
    createTask({ id: "done", title: "Archive notes", completed: true }, NOW),
    createTask({ id: "later", title: "Buy labels", priority: "low", notes: "Office" }, NOW)
  ];

  assert.deepEqual(
    getVisibleTasks(tasks, { status: "overdue" }, "2026-08-04").map((task) => task.id),
    ["overdue"]
  );
  assert.deepEqual(
    getVisibleTasks(tasks, { priority: "low", search: "office" }, "2026-08-04").map(
      (task) => task.id
    ),
    ["later"]
  );
  assert.deepEqual(
    getVisibleTasks(tasks, { status: "completed" }, "2026-08-04").map((task) => task.id),
    ["done"]
  );
});

test("stats count active, complete, and overdue tasks", () => {
  const tasks = [
    createTask({ id: "a", title: "Past due", dueDate: "2026-08-01" }, NOW),
    createTask({ id: "b", title: "Done", completed: true, dueDate: "2026-08-01" }, NOW),
    createTask({ id: "c", title: "Upcoming", dueDate: "2026-08-10" }, NOW)
  ];

  assert.deepEqual(getStats(tasks, "2026-08-04"), {
    total: 3,
    active: 2,
    completed: 1,
    overdue: 1
  });
});

test("clearCompleted and addTask preserve expected ordering", () => {
  const tasks = [
    createTask({ id: "done", title: "Done", completed: true }, NOW),
    createTask({ id: "active", title: "Active" }, NOW)
  ];

  const added = addTask(tasks, { id: "new", title: "New item", priority: "high" }, NOW);
  const activeOnly = clearCompleted(added);

  assert.deepEqual(
    added.map((task) => task.id),
    ["new", "done", "active"]
  );
  assert.deepEqual(
    activeOnly.map((task) => task.id),
    ["new", "active"]
  );
});

test("loadTasks and saveTasks use the supplied storage object", () => {
  const storage = createMemoryStorage();
  const tasks = [createTask({ id: "stored", title: "Persist me" }, NOW)];

  saveTasks(tasks, storage);

  assert.deepEqual(loadTasks(storage), tasks);
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
