// TEMPORARY local preview harness - stubs libspace auth + the potato API.
window.spaceGetToken = () => "dev-token";
window.spaceRedirrectToAuth = () => {};

const API = "/zz/api/space/cimple-table";
let seq = 100;
const nextId = () => ++seq;

const db = {
  tables: [
    { id: 1, name: "Project Roadmap", info: "Delivery plan for the Q3 platform work", icon: "diagram-project", created_at: "", updated_at: "", is_deleted: 0 },
    { id: 2, name: "Team Roster", info: "Who is working on what", icon: "users", created_at: "", updated_at: "", is_deleted: 0 },
    { id: 3, name: "Expenses", info: "", icon: "receipt", created_at: "", updated_at: "", is_deleted: 0 },
  ],
  columns: [
    { id: 11, table_id: 1, name: "Task Name", column_type: "text", info: "", required: true, options: "" },
    { id: 12, table_id: 1, name: "Status", column_type: "dropdown", info: "", required: false, options: "Todo, In Progress, Done" },
    { id: 13, table_id: 1, name: "Priority", column_type: "dropdown", info: "", required: false, options: "Low, Medium, High" },
    { id: 14, table_id: 1, name: "Assignee", column_type: "text", info: "", required: false, options: "" },
    { id: 15, table_id: 1, name: "Est. Hours", column_type: "number", info: "", required: false, options: "" },
    { id: 16, table_id: 1, name: "Due Date", column_type: "date", info: "", required: false, options: "" },
    { id: 17, table_id: 1, name: "Complete", column_type: "checkbox", info: "", required: false, options: "" },
    { id: 18, table_id: 1, name: "Spec", column_type: "link", info: "", required: false, options: "" },
    { id: 21, table_id: 2, name: "Member Name", column_type: "text", info: "", required: true, options: "" },
    { id: 22, table_id: 2, name: "Role", column_type: "text", info: "", required: false, options: "" },
    { id: 23, table_id: 2, name: "Department", column_type: "dropdown", info: "", required: false, options: "Engineering, Design, Product" },
    { id: 24, table_id: 2, name: "Skills", column_type: "multiselect", info: "", required: false, options: "Go, React, Lua, Figma" },
    { id: 25, table_id: 2, name: "Active", column_type: "checkbox", info: "", required: false, options: "" },
  ],
  rows: [],
  cells: [],
};

const seed = (table_id, values) => {
  const row_id = nextId();
  db.rows.push({ id: row_id, table_id, row_data: "", created_at: "", updated_at: "" });
  for (const [column_id, value] of Object.entries(values)) {
    db.cells.push({ id: nextId(), table_id, row_id, column_id: Number(column_id), value: String(value) });
  }
};

seed(1, { 11: "Design system polish", 12: "In Progress", 13: "High", 14: "Alex", 15: 12, 16: "2026-09-01", 17: "false", 18: "https://example.com/spec" });
seed(1, { 11: "OAuth integration", 12: "Done", 13: "Medium", 14: "Devon", 15: 24, 16: "2026-08-15", 17: "true", 18: "" });
seed(1, { 11: "Postgres migration", 12: "Todo", 13: "High", 14: "Sam", 15: 40, 16: "2026-10-05", 17: "false", 18: "" });
seed(1, { 11: "Rate limiting middleware", 12: "Todo", 13: "Low", 14: "Alex", 15: 8, 16: "2026-10-20", 17: "false", 18: "" });
seed(1, { 11: "Audit log viewer", 12: "In Progress", 13: "Medium", 14: "Priya", 15: 16, 16: "2026-09-28", 17: "false", 18: "" });
seed(1, { 11: "Billing webhooks", 12: "Done", 13: "High", 14: "Devon", 15: 20, 16: "2026-08-02", 17: "true", 18: "" });
seed(2, { 21: "Alex Johnson", 22: "Frontend Engineer", 23: "Engineering", 24: "React, Go", 25: "true" });
seed(2, { 21: "Devon Smith", 22: "Product Designer", 23: "Design", 24: "Figma", 25: "true" });
seed(2, { 21: "Sam Taylor", 22: "Product Manager", 23: "Product", 24: "", 25: "false" });

const cellsFor = (row) => db.cells.filter((c) => c.row_id === row.id);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const realFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.startsWith(API)) return realFetch(input, init);

  const path = url.slice(API.length);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const m = (re) => path.match(re);
  await new Promise((r) => setTimeout(r, 80));

  if (path === "/datatables" && method === "GET") return json(db.tables.filter((t) => !t.is_deleted));

  if (path === "/datatables" && method === "POST") {
    const t = { id: nextId(), name: body.name, info: body.info || "", icon: body.icon || "table", is_deleted: 0 };
    db.tables.push(t);
    return json(t);
  }

  let g = m(/^\/datatables\/(\d+)$/);
  if (g) {
    const id = Number(g[1]);
    const t = db.tables.find((x) => x.id === id);
    if (!t) return json({ error: "not found" }, 404);
    if (method === "GET") {
      return json({
        ...t,
        columns: db.columns.filter((c) => c.table_id === id),
        rows: db.rows.filter((r) => r.table_id === id).map((r) => ({ ...r, cells: cellsFor(r) })),
      });
    }
    if (method === "PUT") return json(Object.assign(t, body));
    if (method === "DELETE") {
      t.is_deleted = 1;
      return json({ message: "ok" });
    }
  }

  if (path === "/columns" && method === "POST") {
    const c = { id: nextId(), table_id: body.table_id, name: body.name, column_type: body.column_type, info: body.info || "", required: !!body.required, options: body.options || "" };
    db.columns.push(c);
    return json(c);
  }

  g = m(/^\/columns\/(\d+)$/);
  if (g) {
    const id = Number(g[1]);
    const c = db.columns.find((x) => x.id === id);
    if (method === "PUT") return json(Object.assign(c, body));
    if (method === "DELETE") {
      db.columns = db.columns.filter((x) => x.id !== id);
      db.cells = db.cells.filter((x) => x.column_id !== id);
      return json({ message: "ok" });
    }
  }

  if (path === "/rows" && method === "POST") {
    const r = { id: nextId(), table_id: body.table_id, row_data: body.row_data || "" };
    db.rows.push(r);
    for (const c of body.cells || []) {
      db.cells.push({ id: nextId(), table_id: body.table_id, row_id: r.id, column_id: c.column_id, value: c.value });
    }
    return json({ ...r, cells: cellsFor(r) });
  }

  g = m(/^\/rows\/(\d+)$/);
  if (g && method === "DELETE") {
    const id = Number(g[1]);
    db.rows = db.rows.filter((x) => x.id !== id);
    db.cells = db.cells.filter((x) => x.row_id !== id);
    return json({ message: "ok" });
  }

  if (path === "/cells/upsert" && method === "POST") {
    let cell = db.cells.find(
      (c) => c.row_id === body.row_id && c.column_id === body.column_id
    );
    if (cell) cell.value = body.value || "";
    else {
      cell = { id: nextId(), table_id: body.table_id, row_id: body.row_id, column_id: body.column_id, value: body.value || "" };
      db.cells.push(cell);
    }
    return json(cell);
  }

  return json({ message: "Ok" });
};
