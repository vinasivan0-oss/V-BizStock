// Frontend demo data mirrors the tables and sample rows in the supplied SQL dump.
// Replace this data layer with fetch() calls to a PHP/Node/Python API to use MySQL.
const categories = { 1: "Beverages", 2: "Snacks", 3: "Personal Care" };
const products = [
  {
    product_id: 1,
    category_id: 1,
    product_name: "Bottled Water",
    sku: "BEV-001",
    unit_price: 20,
    cost_price: 12,
    reorder_level: 20,
    stock_quantity: 100,
  },
  {
    product_id: 2,
    category_id: 1,
    product_name: "Soft Drink",
    sku: "BEV-002",
    unit_price: 25,
    cost_price: 15,
    reorder_level: 20,
    stock_quantity: 15,
  },
  {
    product_id: 3,
    category_id: 2,
    product_name: "Potato Chips",
    sku: "SNK-001",
    unit_price: 35,
    cost_price: 22,
    reorder_level: 15,
    stock_quantity: 10,
  },
];
const customers = [
  {
    customer_id: 1,
    customer_name: "Customer1",
    contact_number: "—",
    email: "—",
    address: "—",
  },
  {
    customer_id: 2,
    customer_name: "Customer2",
    contact_number: "09123456789",
    email: "abc@example.com",
    address: "Naga City",
  },
];
const suppliers = [
  {
    supplier_id: 1,
    supplier_name: "ABC Trading",
    contact_number: "09111111111",
    email: "abc@trading.com",
    address: "Naga City",
  },
  {
    supplier_id: 2,
    supplier_name: "XYZ Supplies",
    contact_number: "09222222222",
    email: "xyz@supplies.com",
    address: "Legazpi City",
  },
];
const users = [
  {
    user_id: 1,
    first_name: "Ivan",
    last_name: "Viñas",
    username: "admin",
    role: "Owner",
    is_active: 1,
  },
  {
    user_id: 2,
    first_name: "Juan",
    last_name: "Dela Cruz",
    username: "staff1",
    role: "Staff",
    is_active: 1,
  },
];
const movements = [
  [1, 1, 1, "STOCK_IN", 50, "2026-09-01 00:00:00", "PO-001"],
  [2, 2, 1, "STOCK_IN", 40, "2026-09-01 00:30:00", "PO-002"],
  [3, 3, 1, "STOCK_IN", 30, "2026-09-01 01:00:00", "PO-003"],
  [4, 1, 2, "STOCK_OUT", 5, "2026-09-02 02:15:00", "SALE-001"],
  [5, 2, 2, "STOCK_OUT", 3, "2026-09-02 02:20:00", "SALE-001"],
  [6, 3, 2, "STOCK_OUT", 4, "2026-09-03 03:30:00", "SALE-002"],
  [7, 1, 1, "STOCK_IN", 25, "2026-09-05 00:45:00", "PO-004"],
  [8, 2, 2, "STOCK_OUT", 6, "2026-09-06 06:10:00", "SALE-003"],
  [9, 3, 1, "ADJUSTMENT", 2, "2026-09-07 08:00:00", "ADJ-001"],
  [10, 1, 2, "STOCK_OUT", 8, "2026-09-08 09:20:00", "SALE-004"],
  [11, 2, 1, "STOCK_IN", 20, "2026-09-10 01:00:00", "PO-005"],
  [12, 3, 2, "RETURN", 2, "2026-09-11 05:30:00", "RET-001"],
].map(
  ([
    movement_id,
    product_id,
    user_id,
    movement_type,
    quantity,
    movement_date,
    reference_number,
  ]) => ({
    movement_id,
    product_id,
    user_id,
    movement_type,
    quantity,
    movement_date,
    reference_number,
  }),
);
const sales = [
  {
    sale_id: 1,
    user_id: 2,
    customer_id: 1,
    sale_date: "2026-08-31 23:29:10",
    discount: 0,
    total_amount: 65,
  },
  {
    sale_id: 2,
    user_id: 2,
    customer_id: 2,
    sale_date: "2026-10-01 23:29:10",
    discount: 5,
    total_amount: 90,
  },
];
const saleItems = [
  {
    sale_id: 1,
    product_id: 1,
    quantity: 2,
    unit_price: 20,
    discount: 0,
    subtotal: 40,
  },
  {
    sale_id: 1,
    product_id: 2,
    quantity: 1,
    unit_price: 25,
    discount: 0,
    subtotal: 25,
  },
  {
    sale_id: 2,
    product_id: 3,
    quantity: 3,
    unit_price: 35,
    discount: 5,
    subtotal: 100,
  },
];
const productSuppliers = [
  {
    product_id: 1,
    supplier_id: 1,
    supplier_product_code: "ABC-WATER-01",
    supply_price: 12,
  },
  {
    product_id: 2,
    supplier_id: 1,
    supplier_product_code: "ABC-SODA-01",
    supply_price: 15,
  },
  {
    product_id: 3,
    supplier_id: 2,
    supplier_product_code: "XYZ-CHIPS-01",
    supply_price: 22,
  },
];
const money = (n) =>
  "₱" +
  Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const productName = (id) =>
  products.find((p) => p.product_id === id)?.product_name || "Unknown";
const userName = (id) => {
  const u = users.find((x) => x.user_id === id);
  return u ? u.first_name + " " + u.last_name : "Unknown";
};
const customerName = (id) =>
  customers.find((c) => c.customer_id === id)?.customer_name || "Walk-in";
const supplierName = (id) =>
  suppliers.find((s) => s.supplier_id === id)?.supplier_name || "Unknown";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function renderDashboard() {
  if (!document.getElementById("stat-products")) return;
  document.getElementById("stat-products").textContent = products.length;
  document.getElementById("stat-sales").textContent = money(
    sales.reduce((a, s) => a + s.total_amount, 0),
  );
  document.getElementById("stat-movements").textContent = movements.length;
  document.getElementById("stat-low").textContent = products.filter(
    (p) => p.stock_quantity <= p.reorder_level,
  ).length;
  document.getElementById("today-label").textContent =
    new Date().toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  document.getElementById("recent-movements").innerHTML = [...movements]
    .reverse()
    .slice(0, 5)
    .map(
      (m) =>
        `<tr><td>${esc(productName(m.product_id))}</td><td><span class="pill ${m.movement_type.toLowerCase()}">${m.movement_type.replace("_", " ")}</span></td><td>${m.quantity}</td><td>${m.movement_date.slice(0, 10)}</td></tr>`,
    )
    .join("");
  document.getElementById("stock-overview").innerHTML = products
    .map((p) => {
      const pct = Math.min(
        100,
        (p.stock_quantity / Math.max(p.reorder_level * 3, 1)) * 100,
      );
      return `<div><div class="stock-item-head"><strong>${esc(p.product_name)}</strong><span>${p.stock_quantity} units</span></div><div class="progress"><span style="width:${pct}%"></span></div></div>`;
    })
    .join("");
}
function renderProducts() {
  const q = document.getElementById("product-search").value.toLowerCase(),
    cat = document.getElementById("category-filter").value;
  const rows = products.filter(
    (p) =>
      (p.product_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)) &&
      (!cat || categories[p.category_id] === cat),
  );
  document.getElementById("products-table").innerHTML =
    rows
      .map(
        (p) =>
          `<tr><td>${esc(p.product_name)}</td><td>${esc(p.sku)}</td><td>${categories[p.category_id]}</td><td>${money(p.unit_price)}</td><td>${money(p.cost_price)}</td><td>${p.stock_quantity}</td><td><span class="pill ${p.stock_quantity <= p.reorder_level ? "low" : "good"}">${p.stock_quantity <= p.reorder_level ? "Low stock" : "In stock"}</span></td><td><button class="delete-btn" type="button" data-delete-product="${p.product_id}" aria-label="Delete ${esc(p.product_name)}">Delete</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="8">No products match your search.</td></tr>';
}
function deleteProduct(productId) {
  const productIndex = products.findIndex((p) => p.product_id === productId);
  if (productIndex === -1) return;

  const product = products[productIndex];
  if (!window.confirm(`Delete "${product.product_name}"? This cannot be undone.`))
    return;

  products.splice(productIndex, 1);
  renderProducts();
}
function renderMovements() {
  const filter = document.getElementById("movement-filter").value;
  document.getElementById("movements-table").innerHTML = [...movements]
    .reverse()
    .filter((m) => !filter || m.movement_type === filter)
    .map(
      (m) =>
        `<tr><td>${m.movement_id}</td><td>${esc(productName(m.product_id))}</td><td><span class="pill ${m.movement_type.toLowerCase()}">${m.movement_type.replace("_", " ")}</span></td><td>${m.quantity}</td><td>${esc(userName(m.user_id))}</td><td>${m.movement_date}</td><td>${esc(m.reference_number)}</td></tr>`,
    )
    .join("");
}
function renderOtherTables() {
  const salesTable = document.getElementById("sales-table");
  if (salesTable)
    salesTable.innerHTML = sales
      .map(
        (s) =>
          `<tr><td>#${s.sale_id}</td><td>${s.sale_date}</td><td>${esc(customerName(s.customer_id))}</td><td>${esc(userName(s.user_id))}</td><td>${money(s.discount)}</td><td><strong>${money(s.total_amount)}</strong></td></tr>`,
      )
      .join("");
  const saleItemsTable = document.getElementById("sale-items-table");
  if (saleItemsTable)
    saleItemsTable.innerHTML = saleItems
      .map(
        (i) =>
          `<tr><td>#${i.sale_id}</td><td>${esc(productName(i.product_id))}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.discount)}</td><td>${money(i.subtotal)}</td></tr>`,
      )
      .join("");
  const suppliersTable = document.getElementById("suppliers-table");
  if (suppliersTable)
    suppliersTable.innerHTML = suppliers
      .map(
        (s) =>
          `<tr><td>${s.supplier_id}</td><td>${esc(s.supplier_name)}</td><td>${esc(s.contact_number)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td></tr>`,
      )
      .join("");
  const productSuppliersTable = document.getElementById(
    "product-suppliers-table",
  );
  if (productSuppliersTable)
    productSuppliersTable.innerHTML = productSuppliers
      .map(
        (x) =>
          `<tr><td>${esc(productName(x.product_id))}</td><td>${esc(supplierName(x.supplier_id))}</td><td>${esc(x.supplier_product_code)}</td><td>${money(x.supply_price)}</td></tr>`,
      )
      .join("");
  const usersTable = document.getElementById("users-table");
  if (usersTable)
    usersTable.innerHTML = users
      .map(
        (u) =>
          `<tr><td>${u.user_id}</td><td>${esc(u.first_name + " " + u.last_name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td><span class="pill good">${u.is_active ? "Active" : "Inactive"}</span></td></tr>`,
      )
      .join("");
}
const productSearch = document.getElementById("product-search");
if (productSearch) productSearch.addEventListener("input", renderProducts);
const productsTable = document.getElementById("products-table");
if (productsTable) {
  productsTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-product]");
    if (button) deleteProduct(Number(button.dataset.deleteProduct));
  });
}
const categoryFilter = document.getElementById("category-filter");
if (categoryFilter) categoryFilter.addEventListener("change", renderProducts);
const movementFilter = document.getElementById("movement-filter");
if (movementFilter) movementFilter.addEventListener("change", renderMovements);
const dialog = document.getElementById("product-dialog");
if (dialog) {
  document.getElementById("add-product-btn").addEventListener("click", () => {
    document.getElementById("form-error").textContent = "";
    dialog.showModal();
  });
  document
    .getElementById("close-dialog")
    .addEventListener("click", () => dialog.close());
  document.getElementById("product-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const sku = data.sku.trim();
    if (products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
      document.getElementById("form-error").textContent =
        "That SKU already exists. Please use a unique SKU.";
      return;
    }
    products.push({
      product_id: Math.max(...products.map((p) => p.product_id), 0) + 1,
      category_id: Number(data.category_id),
      product_name: data.product_name.trim(),
      sku,
      unit_price: Number(data.unit_price),
      cost_price: Number(data.cost_price),
      stock_quantity: Number(data.stock_quantity),
      reorder_level: Number(data.reorder_level),
    });
    e.currentTarget.reset();
    dialog.close();
    renderProducts();
  });
}
const page = document.body.dataset.page;
if (page === "dashboard") renderDashboard();
if (page === "products") renderProducts();
if (page === "movements") renderMovements();
renderOtherTables();
