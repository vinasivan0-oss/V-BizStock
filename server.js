require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool, Client, types } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const PORT = Number(process.env.PORT) || 3000;
const DB_NAME = process.env.DB_NAME || "vbizstock_db";
const ADMIN_DB = process.env.DB_ADMIN_DB || "postgres"; // used only to create DB_NAME if it does not exist
const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "vbizstock132",
};
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const COOKIE_NAME = "vbizstock_token";
const SESSION_HOURS = 8;
const RESET_KEY = "sales_total_reset_through_id";

// Return plain numbers and date strings, which is what the frontend expects.
types.setTypeParser(20, (v) => Number(v));       // bigint (ids, COUNT(*))
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric / decimal
types.setTypeParser(1114, (v) => v);             // timestamp -> "YYYY-MM-DD HH:MM:SS"
types.setTypeParser(1184, (v) => v);             // timestamptz

let pool;

// Queries below are written with "?" placeholders; convert them to $1, $2, ... for pg.
const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};
const db = { query: (sql, params) => pool.query(toPg(sql), params) };

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;



/* ------------------------------------------------------------------ */
/* Database setup                                                      */
/* ------------------------------------------------------------------ */
async function initDatabase() {

  
  const admin = new Client({ ...DB_CONFIG, database: ADMIN_DB });
  await admin.connect();
  try {
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (!found.rowCount) await admin.query(`CREATE DATABASE ${quoteIdent(DB_NAME)}`);
  } finally {
    await admin.end();
  }

  pool = new Pool({ ...DB_CONFIG, database: DB_NAME, max: 10 });
  pool.on("error", (err) => console.error("Unexpected PostgreSQL pool error:", err.message));

  const schema = fs.readFileSync(path.join(__dirname, "db", "VBizStock_DB.sql"), "utf8");
  await pool.query(schema);
  // Reference data required by the app (not sample data): the two roles.
  await pool.query("INSERT INTO role (role_name) VALUES ('Admin'), ('Staff') ON CONFLICT (role_name) DO NOTHING");
}

async function withTx(fn) {
  const client = await pool.connect();
  const tx = { query: (sql, params) => client.query(toPg(sql), params) };
  try {
    await client.query("BEGIN");
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}





/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new HttpError(400, message);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function text(value, label, max, required = true) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v && required) throw bad(`${label} is required.`);
  if (v.length > max) throw bad(`${label} must be ${max} characters or fewer.`);
  return v || null;
}
function money(value, label) {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n) || n < 0)
    throw bad(`${label} must be a non-negative number.`);
  return Math.round(n * 100) / 100;
}
function integer(value, label, min = 0) {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isInteger(n) || n < min)
    throw bad(`${label} must be a whole number of at least ${min}.`);
  return n;
}
const idParam = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw bad("Invalid ID.");
  return n;
};
const statusOut = (s) => (s === "inactive" ? "Inactive" : "Active");
const statusIn = (s) => {
  const v = String(s || "").toLowerCase();
  if (!["active", "inactive"].includes(v)) throw bad("Status must be Active or Inactive.");
  return v;
};
function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8)
    throw bad("Passwords must contain at least 8 characters.");
}





/* ------------------------------------------------------------------ */
/* Auth middleware                                                     */
/* ------------------------------------------------------------------ */
const USER_SELECT = `SELECT u.user_id, u.username, u.first_name, u.last_name, u.is_active, r.role_name AS role
                     FROM users u JOIN role r ON r.role_id = u.role_id`;

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) throw new HttpError(401, "Please sign in.");
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new HttpError(401, "Your session has expired. Please sign in again.");
    }
    const { rows } = await db.query(`${USER_SELECT} WHERE u.user_id = ?`, [payload.uid]);
    if (!rows.length || !rows[0].is_active) throw new HttpError(401, "Account is not available.");
    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, "You do not have permission to do that."));
const adminOnly = requireRole("Admin");
const staffOnly = requireRole("Staff");

function startSession(res, userId) {
  const token = jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_HOURS * 3600 * 1000,
  });
}





/* ------------------------------------------------------------------ */
/* App + routes                                                        */
/* ------------------------------------------------------------------ */
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

const api = express.Router();
app.use("/api", api);



/* ---- Auth ---- */
api.get("/auth/status", wrap(async (req, res) => {
  const { rows: [{ n }] } = await db.query("SELECT COUNT(*) AS n FROM users");
  res.json({ needsSetup: n === 0 });
}));

api.post("/auth/setup", wrap(async (req, res) => {
  const b = req.body || {};
  const first = text(b.first_name, "First name", 50);
  const last = text(b.last_name, "Last name", 50);
  const username = text(b.username, "Username", 50).toLowerCase();
  checkPassword(b.password);
  if (b.password !== b.confirm_password) throw bad("The passwords do not match.");
  const hash = await bcrypt.hash(b.password, 10);
  const userId = await withTx(async (conn) => {
    // FOR UPDATE is not allowed with COUNT(*) in PostgreSQL; lock the table to serialise first-run setup.
    await conn.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const { rows: [{ n }] } = await conn.query("SELECT COUNT(*) AS n FROM users");
    if (n > 0) throw new HttpError(403, "Setup is already complete. Please sign in.");
    const { rows: [role] } = await conn.query("SELECT role_id FROM role WHERE role_name = 'Admin'");
    const { rows: [created] } = await conn.query(
      "INSERT INTO users (role_id, username, password_hash, first_name, last_name, is_active) VALUES (?,?,?,?,?,1) RETURNING user_id",
      [role.role_id, username, hash, first, last],
    );
    return created.user_id;
  });
  startSession(res, userId);
  const { rows } = await db.query(`${USER_SELECT} WHERE u.user_id = ?`, [userId]);
  res.status(201).json({ user: rows[0] });
}));

api.post("/auth/login", wrap(async (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const { rows } = await db.query(
    `SELECT u.user_id, u.username, u.first_name, u.last_name, u.is_active, r.role_name AS role,
            u.password_hash AS _hash
     FROM users u JOIN role r ON r.role_id = u.role_id WHERE u.username = ?`,
    [username],
  );
  const row = rows[0];
  const ok = row && row.is_active && (await bcrypt.compare(password, row._hash));
  if (!ok) throw new HttpError(401, "Incorrect username or password.");
  delete row._hash;
  startSession(res, row.user_id);
  res.json({ user: row });
}));

api.post("/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

api.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));



/* Everything below requires a signed-in user */
api.use(requireAuth);




/* ---- Users (admin) ---- */
api.get("/users", adminOnly, wrap(async (req, res) => {
  const { rows } = await db.query(`${USER_SELECT} ORDER BY u.user_id`);
  res.json(rows);
}));

async function assertAdminRemains(conn) {
  const { rows: [{ n }] } = await conn.query(
    `SELECT COUNT(*) AS n FROM users u JOIN role r ON r.role_id = u.role_id
     WHERE r.role_name = 'Admin' AND u.is_active = 1`,
  );
  if (n < 1) throw bad("At least one active admin account must remain.");
}

function userFields(b) {
  const role = b.role;
  if (!["Admin", "Staff"].includes(role)) throw bad("Choose a valid role.");
  const active = Number(b.is_active);
  if (![0, 1].includes(active)) throw bad("Choose a valid status.");
  return {
    first: text(b.first_name, "First name", 50),
    last: text(b.last_name, "Last name", 50),
    username: text(b.username, "Username", 50).toLowerCase(),
    role,
    active,
  };
}

api.post("/users", adminOnly, wrap(async (req, res) => {
  const f = userFields(req.body || {});
  checkPassword(req.body.password);
  if (req.body.password !== req.body.confirm_password) throw bad("The passwords do not match.");
  const hash = await bcrypt.hash(req.body.password, 10);
  const { rows: [role] } = await db.query("SELECT role_id FROM role WHERE role_name = ?", [f.role]);
  const { rows: [created] } = await db.query(
    "INSERT INTO users (role_id, username, password_hash, first_name, last_name, is_active) VALUES (?,?,?,?,?,?) RETURNING user_id",
    [role.role_id, f.username, hash, f.first, f.last, f.active],
  );
  res.status(201).json({ user_id: created.user_id });
}));

api.put("/users/:id", adminOnly, wrap(async (req, res) => {
  const id = idParam(req.params.id);
  const f = userFields(req.body || {});
  const { password, confirm_password } = req.body;
  let hash = null;
  if (password || confirm_password) {
    checkPassword(password);
    if (password !== confirm_password) throw bad("The passwords do not match.");
    hash = await bcrypt.hash(password, 10);
  }
  if (id === req.user.user_id && f.active === 0) throw bad("You cannot deactivate your own account.");
  await withTx(async (conn) => {
    const { rows: [role] } = await conn.query("SELECT role_id FROM role WHERE role_name = ?", [f.role]);
    const sets = ["role_id=?", "username=?", "first_name=?", "last_name=?", "is_active=?"];
    const vals = [role.role_id, f.username, f.first, f.last, f.active];
    if (hash) {
      sets.push("password_hash=?");
      vals.push(hash);
    }
    const r = await conn.query(`UPDATE users SET ${sets.join(", ")} WHERE user_id=?`, [...vals, id]);
    if (!r.rowCount) throw new HttpError(404, "User not found.");
    await assertAdminRemains(conn);
  });
  res.json({ ok: true });
}));

api.delete("/users/:id", adminOnly, wrap(async (req, res) => {
  const id = idParam(req.params.id);
  if (id === req.user.user_id) throw bad("You cannot delete the account you are currently using.");
  await withTx(async (conn) => {
    const r = await conn.query("DELETE FROM users WHERE user_id = ?", [id]);
    if (!r.rowCount) throw new HttpError(404, "User not found.");
    await assertAdminRemains(conn);
  });
  res.json({ ok: true });
}));





/* ---- Categories ---- */
api.get("/categories", wrap(async (req, res) => {
  const { rows } = await db.query("SELECT category_id, category_name FROM category ORDER BY category_name");
  res.json(rows);
}));
api.post("/categories", adminOnly, wrap(async (req, res) => {
  const name = text(req.body?.category_name, "Category name", 100);
  const { rows: [created] } = await db.query(
    "INSERT INTO category (category_name) VALUES (?) RETURNING category_id",
    [name],
  );
  res.status(201).json({ category_id: created.category_id, category_name: name });
}));
api.delete("/categories/:id", adminOnly, wrap(async (req, res) => {
  const r = await db.query("DELETE FROM category WHERE category_id = ?", [idParam(req.params.id)]);
  if (!r.rowCount) throw new HttpError(404, "Category not found.");
  res.json({ ok: true });
}));





/* ---- Products ---- */
const PRODUCT_SELECT = `SELECT p.product_id, p.category_id, c.category_name, p.product_name, p.sku,
  p.unit_price, p.cost_price, p.reorder_level, p.stock_quantity, p.status
  FROM product p JOIN category c ON c.category_id = p.category_id`;

api.get("/products", wrap(async (req, res) => {
  const { rows } = await db.query(`${PRODUCT_SELECT} ORDER BY p.product_name`);
  res.json(rows.map((p) => ({ ...p, status: statusOut(p.status) })));
}));

function productFields(b) {
  return {
    category_id: idParam(b.category_id),
    name: text(b.product_name, "Product name", 50),
    sku: text(b.sku, "SKU", 30),
    unit_price: money(b.unit_price, "Unit price"),
    cost_price: money(b.cost_price, "Cost price"),
    reorder_level: integer(b.reorder_level, "Reorder level"),
  };
}

api.post("/products", adminOnly, wrap(async (req, res) => {
  const f = productFields(req.body || {});
  const stock = integer(req.body.stock_quantity ?? 0, "Stock quantity");
  const id = await withTx(async (conn) => {
    const { rows: [created] } = await conn.query(
      `INSERT INTO product (category_id, product_name, sku, unit_price, cost_price, reorder_level, stock_quantity, status)
       VALUES (?,?,?,?,?,?,?, 'active') RETURNING product_id`,
      [f.category_id, f.name, f.sku, f.unit_price, f.cost_price, f.reorder_level, stock],
    );
    const newId = created.product_id;
    if (stock > 0) {
      await conn.query(
        `INSERT INTO inventory_movement (product_id, user_id, movement_type, quantity, reference_number, remarks)
         VALUES (?,?, 'STOCK_IN', ?, ?, 'Initial stock')`,
        [newId, req.user.user_id, stock, `INITIAL-${newId}`],
      );
    }
    return newId;
  });
  res.status(201).json({ product_id: id });
}));

api.put("/products/:id", adminOnly, wrap(async (req, res) => {
  const id = idParam(req.params.id);
  const f = productFields(req.body || {});
  const stock = integer(req.body.stock_quantity, "Stock quantity");
  const status = statusIn(req.body.status);
  await withTx(async (conn) => {
    const { rows: [current] } = await conn.query("SELECT stock_quantity FROM product WHERE product_id = ? FOR UPDATE", [id]);
    if (!current) throw new HttpError(404, "Product not found.");
    await conn.query(
      `UPDATE product SET category_id=?, product_name=?, sku=?, unit_price=?, cost_price=?, reorder_level=?,
       stock_quantity=?, status=? WHERE product_id=?`,
      [f.category_id, f.name, f.sku, f.unit_price, f.cost_price, f.reorder_level, stock, status, id],
    );
    const change = stock - current.stock_quantity;
    if (change !== 0) {
      await conn.query(
        `INSERT INTO inventory_movement (product_id, user_id, movement_type, quantity, reference_number, remarks)
         VALUES (?,?,?,?,?, 'Stock changed from product update')`,
        [id, req.user.user_id, change > 0 ? "STOCK_IN" : "STOCK_OUT", Math.abs(change), `PRODUCT-UPDATE-${id}`],
      );
    }
  });
  res.json({ ok: true });
}));

api.delete("/products/:id", adminOnly, wrap(async (req, res) => {
  const id = idParam(req.params.id);
  await withTx(async (conn) => {
    const { rows: [sold] } = await conn.query("SELECT COUNT(*) AS n FROM sale_item WHERE product_id = ?", [id]);
    if (sold.n > 0)
      throw new HttpError(409, "This product has sales history and cannot be deleted. Set it to Inactive instead.");
    await conn.query("DELETE FROM inventory_movement WHERE product_id = ?", [id]);
    const r = await conn.query("DELETE FROM product WHERE product_id = ?", [id]);
    if (!r.rowCount) throw new HttpError(404, "Product not found.");
  });
  res.json({ ok: true });
}));





/* ---- Suppliers ---- */
api.get("/suppliers", adminOnly, wrap(async (req, res) => {
  const { rows } = await db.query(
    "SELECT supplier_id, supplier_name, contact_number, email, address FROM supplier ORDER BY supplier_id",
  );
  res.json(rows);
}));
api.post("/suppliers", adminOnly, wrap(async (req, res) => {
  const b = req.body || {};
  const name = text(b.supplier_name, "Supplier name", 50);
  const dup = await db.query("SELECT 1 FROM supplier WHERE LOWER(supplier_name) = LOWER(?)", [name]);
  if (dup.rowCount) throw new HttpError(409, "That supplier already exists.");
  const { rows: [created] } = await db.query(
    "INSERT INTO supplier (supplier_name, contact_number, email, address) VALUES (?,?,?,?) RETURNING supplier_id",
    [name, text(b.contact_number, "Contact number", 30, false), text(b.email, "Email", 50, false), text(b.address, "Address", 80, false)],
  );
  res.status(201).json({ supplier_id: created.supplier_id });
}));
api.delete("/suppliers/:id", adminOnly, wrap(async (req, res) => {
  const id = idParam(req.params.id);
  await withTx(async (conn) => {
    await conn.query("DELETE FROM product_supplier WHERE supplier_id = ?", [id]);
    const r = await conn.query("DELETE FROM supplier WHERE supplier_id = ?", [id]);
    if (!r.rowCount) throw new HttpError(404, "Supplier not found.");
  });
  res.json({ ok: true });
}));





/* ---- Product suppliers ---- */
api.get("/product-suppliers", adminOnly, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT ps.product_id, p.product_name, ps.supplier_id, s.supplier_name, ps.supplier_product_code, ps.supply_price
     FROM product_supplier ps
     JOIN product p ON p.product_id = ps.product_id
     JOIN supplier s ON s.supplier_id = ps.supplier_id
     ORDER BY p.product_name, s.supplier_name`,
  );
  res.json(rows);
}));
function psFields(b) {
  return [
    idParam(b.product_id),
    idParam(b.supplier_id),
    text(b.supplier_product_code, "Supplier product code", 30),
    money(b.supply_price, "Supply price"),
  ];
}
const DUP_PS = "That product is already linked to this supplier.";
api.post("/product-suppliers", adminOnly, wrap(async (req, res) => {
  const [pid, sid, code, price] = psFields(req.body || {});
  try {
    await db.query(
      "INSERT INTO product_supplier (product_id, supplier_id, supplier_product_code, supply_price) VALUES (?,?,?,?)",
      [pid, sid, code, price],
    );
  } catch (e) {
    if (e.code === "23505") throw new HttpError(409, DUP_PS);
    throw e;
  }
  res.status(201).json({ ok: true });
}));
api.put("/product-suppliers/:productId/:supplierId", adminOnly, wrap(async (req, res) => {
  const [pid, sid, code, price] = psFields(req.body || {});
  try {
    const r = await db.query(
      `UPDATE product_supplier SET product_id=?, supplier_id=?, supplier_product_code=?, supply_price=?
       WHERE product_id=? AND supplier_id=?`,
      [pid, sid, code, price, idParam(req.params.productId), idParam(req.params.supplierId)],
    );
    if (!r.rowCount) throw new HttpError(404, "Link not found.");
  } catch (e) {
    if (e.code === "23505") throw new HttpError(409, DUP_PS);
    throw e;
  }
  res.json({ ok: true });
}));
api.delete("/product-suppliers/:productId/:supplierId", adminOnly, wrap(async (req, res) => {
  const r = await db.query("DELETE FROM product_supplier WHERE product_id=? AND supplier_id=?", [
    idParam(req.params.productId),
    idParam(req.params.supplierId),
  ]);
  if (!r.rowCount) throw new HttpError(404, "Link not found.");
  res.json({ ok: true });
}));





/* ---- Inventory movements ---- */
api.get("/movements", adminOnly, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.movement_id, m.product_id, p.product_name, m.user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS user_name,
            m.movement_type, m.quantity, m.movement_date, m.reference_number, m.remarks
     FROM inventory_movement m
     JOIN product p ON p.product_id = m.product_id
     JOIN users u ON u.user_id = m.user_id
     ORDER BY m.movement_id DESC`,
  );
  res.json(rows);
}));

api.post("/movements", adminOnly, wrap(async (req, res) => {
  const b = req.body || {};
  const productId = idParam(b.product_id);
  const type = b.movement_type;
  if (!["STOCK_IN", "STOCK_OUT", "RETURN"].includes(type)) throw bad("Choose a valid movement type.");
  const qty = integer(b.quantity, "Quantity", 1);
  const ref = text(b.reference_number, "Reference", 100, false);
  const remarks = text(b.remarks, "Remarks", 255, false);
  await withTx(async (conn) => {
    const { rows: [p] } = await conn.query("SELECT stock_quantity FROM product WHERE product_id = ? FOR UPDATE", [productId]);
    if (!p) throw new HttpError(404, "Product not found.");
    const delta = type === "STOCK_OUT" ? -qty : qty;
    if (p.stock_quantity + delta < 0) throw bad(`Only ${p.stock_quantity} units are in stock.`);
    await conn.query("UPDATE product SET stock_quantity = stock_quantity + ? WHERE product_id = ?", [delta, productId]);
    await conn.query(
      `INSERT INTO inventory_movement (product_id, user_id, movement_type, quantity, reference_number, remarks)
       VALUES (?,?,?,?,?,?)`,
      [productId, req.user.user_id, type, qty, ref, remarks],
    );
  });
  res.status(201).json({ ok: true });
}));





// History only: these do not change product stock.
api.delete("/movements/:id", adminOnly, wrap(async (req, res) => {
  const r = await db.query("DELETE FROM inventory_movement WHERE movement_id = ?", [idParam(req.params.id)]);
  if (!r.rowCount) throw new HttpError(404, "Movement not found.");
  res.json({ ok: true });
}));
api.delete("/movements", adminOnly, wrap(async (req, res) => {
  await db.query("DELETE FROM inventory_movement");
  res.json({ ok: true });
}));

/* ---- Sales ---- */
api.post("/sales", staffOnly, wrap(async (req, res) => {
  const raw = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!raw.length) throw bad("The cart is empty.");
  const wanted = new Map();
  for (const item of raw) {
    const pid = idParam(item.product_id);
    const qty = integer(item.quantity, "Quantity", 1);
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }
  const ids = [...wanted.keys()].sort((a, b) => a - b);

  const result = await withTx(async (conn) => {
    const { rows: products } = await conn.query(
      "SELECT product_id, product_name, unit_price, stock_quantity, status FROM product WHERE product_id = ANY(?) ORDER BY product_id FOR UPDATE",
      [ids],
    );
    const byId = new Map(products.map((p) => [p.product_id, p]));
    let total = 0;
    for (const id of ids) {
      const p = byId.get(id);
      const qty = wanted.get(id);
      if (!p || p.status !== "active") throw new HttpError(409, "A product in the cart is no longer available.");
      if (qty > p.stock_quantity)
        throw new HttpError(409, `Not enough stock for ${p.product_name}. Only ${p.stock_quantity} left.`);
      total += Math.round(qty * p.unit_price * 100) / 100;
    }
    const { rows: [sale] } = await conn.query(
      "INSERT INTO sale (user_id, discount, total_amount) VALUES (?, 0, ?) RETURNING sale_id",
      [req.user.user_id, total],
    );
    const reference = `SALE-${String(sale.sale_id).padStart(3, "0")}`;
    for (const id of ids) {
      const p = byId.get(id);
      const qty = wanted.get(id);
      await conn.query(
        "INSERT INTO sale_item (sale_id, product_id, quantity, unit_price, discount, subtotal) VALUES (?,?,?,?,0,?)",
        [sale.sale_id, id, qty, p.unit_price, Math.round(qty * p.unit_price * 100) / 100],
      );
      await conn.query("UPDATE product SET stock_quantity = stock_quantity - ? WHERE product_id = ?", [qty, id]);
      await conn.query(
        `INSERT INTO inventory_movement (product_id, user_id, movement_type, quantity, reference_number)
         VALUES (?,?, 'STOCK_OUT', ?, ?)`,
        [id, req.user.user_id, qty, reference],
      );
    }
    return { sale_id: sale.sale_id, reference, total };
  });
  res.status(201).json(result);
}));

api.get("/sales/items", requireRole("Admin", "Staff"), wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT si.sale_id, si.product_id, p.product_name, si.quantity, si.unit_price, si.discount, si.subtotal
     FROM sale_item si JOIN product p ON p.product_id = si.product_id
     ORDER BY si.sale_id DESC, p.product_name`,
  );
  res.json(rows);
}));





// History only: these do not change stock or sales totals.
api.delete("/sales/items/:saleId/:productId", staffOnly, wrap(async (req, res) => {
  const r = await db.query("DELETE FROM sale_item WHERE sale_id=? AND product_id=?", [
    idParam(req.params.saleId),
    idParam(req.params.productId),
  ]);
  if (!r.rowCount) throw new HttpError(404, "Sale item not found.");
  res.json({ ok: true });
}));
api.delete("/sales/items", staffOnly, wrap(async (req, res) => {
  await db.query("DELETE FROM sale_item");
  res.json({ ok: true });
}));






/* ---- Dashboard ---- */
async function resetThroughId() {
  const { rows } = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = ?", [RESET_KEY]);
  return rows.length ? Number(rows[0].setting_value) || 0 : 0;
}

api.get("/dashboard", adminOnly, wrap(async (req, res) => {
  const resetId = await resetThroughId();
  const { rows: [counts] } = await db.query(
    `SELECT (SELECT COUNT(*) FROM product) AS products,
            (SELECT COUNT(*) FROM inventory_movement) AS movements,
            (SELECT COUNT(*) FROM product WHERE stock_quantity <= reorder_level) AS low_stock`,
  );
  const { rows: [sales] } = await db.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS total FROM sale WHERE sale_id > ?",
    [resetId],
  );
  const { rows: recent } = await db.query(
    `SELECT m.movement_id, p.product_name, m.movement_type, m.quantity, m.movement_date
     FROM inventory_movement m JOIN product p ON p.product_id = m.product_id
     ORDER BY m.movement_id DESC LIMIT 5`,
  );
  const { rows: stock } = await db.query(
    "SELECT product_id, product_name, stock_quantity, reorder_level FROM product ORDER BY product_name",
  );
  res.json({ ...counts, total_sales: sales.total, recent_movements: recent, stock_overview: stock });
}));

api.post("/dashboard/reset-sales", adminOnly, wrap(async (req, res) => {
  const { rows: [{ max_id }] } = await db.query("SELECT COALESCE(MAX(sale_id), 0) AS max_id FROM sale");
  await db.query(
    "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
    [RESET_KEY, String(max_id)],
  );
  res.json({ ok: true });
}));

api.use((req, res, next) => next(new HttpError(404, "Not found.")));





/* ---- Static frontend ---- */
app.use(express.static(path.join(__dirname, "frontend")));
app.get("/", (req, res) => res.redirect("/login.html"));





/* ---- Errors ---- */
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request body." });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === "23505") {
    // unique_violation
    const c = String(err.constraint || "");
    let msg = "That record already exists.";
    if (c.includes("sku")) msg = "That SKU already exists. Please use a unique SKU.";
    else if (c.includes("username")) msg = "That username is already in use.";
    else if (c.includes("category_name")) msg = "That category already exists.";
    return res.status(409).json({ error: msg });
  }
  if (err.code === "23503") {
    // foreign_key_violation. "update or delete on table ..." means another table still references this row.
    if (/^update or delete on table/.test(String(err.message))) {
      return res.status(409).json({
        error: "This record is used by other records (for example sales, movements or products) and cannot be deleted.",
      });
    }
    return res.status(400).json({ error: "A selected product, category or supplier no longer exists." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VBizStock is running at http://localhost:${PORT}`);
      console.log(`Connected to PostgreSQL database "${DB_NAME}" on ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    });
  })
  .catch((error) => {
    console.error("\nCould not connect to PostgreSQL. Make sure the server is running, then check the DB_* values in .env.");
    console.error(error.message);
    process.exit(1);
  });
