# to-d0

`to-d0` is a lightweight browser-based to-do app for tracking personal tasks without a backend or build step.

## Features

- Add tasks with a title, priority, and optional due date.
- Mark tasks complete, edit task details, and delete tasks.
- Filter by all, active, or completed tasks.
- Search the visible task list.
- Sort by newest, due date, or priority.
- See total, active, completed, and due-today counts.
- Clear completed tasks in one action.
- Persist tasks locally in the browser with `localStorage`, including safe loading for older saved task data.
- Responsive layout for desktop and mobile screens.

## Run Locally

Open `index.html` in a browser.

You can also serve the directory with any static file server:

```sh
npx serve .
```

## Project Structure

```text
.
├── app.js
├── index.html
├── styles.css
└── README.md
```

## Notes

The app has no package dependencies. Task data stays on the device where it was created because it is stored in the browser.
