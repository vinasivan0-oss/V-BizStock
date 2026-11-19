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
    status: "Active",
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
    status: "Active",
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
    status: "Active",
    reorder_level: 15,
    stock_quantity: 10,
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
let users = window.getAppUsers();
const movements = [
  [1, 1, 1, "STOCK_IN", 50, "2026-09-01 00:00:00", "PO-001"],
  [2, 2, 1, "STOCK_IN", 40, "2026-09-01 00:30:00", "PO-002"],
  [3, 3, 1, "STOCK_IN", 30, "2026-09-01 01:00:00", "PO-003"],
  [4, 1, 2, "STOCK_OUT", 5, "2026-09-02 02:15:00", "SALE-001"],
  [5, 2, 2, "STOCK_OUT", 3, "2026-09-02 02:20:00", "SALE-001"],
  [6, 3, 2, "STOCK_OUT", 4, "2026-09-03 03:30:00", "SALE-002"],
  [7, 1, 1, "STOCK_IN", 25, "2026-09-05 00:45:00", "PO-004"],
  [8, 2, 2, "STOCK_OUT", 6, "2026-09-06 06:10:00", "SALE-003"],
  [10, 1, 2, "STOCK_OUT", 8, "2026-09-08 09:20:00", "SALE-004"],
  [11, 2, 1, "STOCK_IN", 20, "2026-09-10 01:00:00", "PO-005"],
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
const transactionStorageKey = "smallbiz-sales-transactions";
const productStorageKey = "smallbiz-products";
const supplierStorageKey = "smallbiz-supplier-data";
const cart = new Map();
const addedSales = [];
const addedSaleItems = [];
const addedMovements = [];
const deletedMovementIds = new Set();
const deletedSaleItemKeys = new Set();
const saleItemKey = (item) => `${item.sale_id}:${item.product_id}`;
const nextMovementId = () =>
  Math.max(
    ...movements.map((movement) => movement.movement_id),
    ...deletedMovementIds,
    0,
  ) + 1;
function restoreTransactions() {
  try {
    const saved = localStorage.getItem(transactionStorageKey);
    if (!saved) return;

    const state = JSON.parse(saved);
    if (
      !Array.isArray(state.sales) ||
      !Array.isArray(state.saleItems) ||
      !Array.isArray(state.movements) ||
      !Array.isArray(state.stock)
    ) {
      throw new Error("Saved sales data has an unexpected format.");
    }

    const savedDeletedMovementIds =
      state.deletedMovementIds === undefined ? [] : state.deletedMovementIds;
    if (
      !Array.isArray(savedDeletedMovementIds) ||
      savedDeletedMovementIds.some((movementId) => !Number.isInteger(movementId))
    ) {
      throw new Error("Saved movement deletion data is invalid.");
    }
    savedDeletedMovementIds.forEach((movementId) =>
      deletedMovementIds.add(movementId),
    );
    const savedDeletedSaleItemKeys =
      state.deletedSaleItemKeys === undefined ? [] : state.deletedSaleItemKeys;
    if (
      !Array.isArray(savedDeletedSaleItemKeys) ||
      savedDeletedSaleItemKeys.some((itemKey) => typeof itemKey !== "string")
    ) {
      throw new Error("Saved sale item deletion data is invalid.");
    }
    savedDeletedSaleItemKeys.forEach((itemKey) =>
      deletedSaleItemKeys.add(itemKey),
    );
    state.stock.forEach(({ product_id, stock_quantity }) => {
      if (
        !Number.isInteger(product_id) ||
        !Number.isInteger(stock_quantity) ||
        stock_quantity < 0
      ) {
        throw new Error("Saved stock data is invalid.");
      }
    });
    state.sales.forEach((sale) => {
      if (!Number.isInteger(sale.sale_id) || !Number.isFinite(sale.total_amount))
        throw new Error("Saved sale data is invalid.");
    });
    state.stock.forEach(({ product_id, stock_quantity }) => {
      const product = products.find((item) => item.product_id === product_id);
      if (product) product.stock_quantity = stock_quantity;
    });
    movements.splice(
      0,
      movements.length,
      ...movements.filter(
        (movement) => !deletedMovementIds.has(movement.movement_id),
      ),
    );
    const savedMovements = state.movements.filter(
      (movement) => !deletedMovementIds.has(movement.movement_id),
    );
    const savedSaleItems = state.saleItems.filter(
      (item) => !deletedSaleItemKeys.has(saleItemKey(item)),
    );
    saleItems.splice(
      0,
      saleItems.length,
      ...saleItems.filter((item) => !deletedSaleItemKeys.has(saleItemKey(item))),
    );
    sales.push(...state.sales);
    saleItems.push(...savedSaleItems);
    movements.push(...savedMovements);
    addedSales.push(...state.sales);
    addedSaleItems.push(...savedSaleItems);
    addedMovements.push(...savedMovements);
  } catch (error) {
    window.alert(`Could not load saved sales data: ${error.message}`);
  }
}
function saveTransactions(
  nextSales,
  nextSaleItems,
  nextMovements,
  stock,
  nextDeletedMovementIds = deletedMovementIds,
  nextDeletedSaleItemKeys = deletedSaleItemKeys,
) {
  localStorage.setItem(
    transactionStorageKey,
    JSON.stringify({
      sales: nextSales,
      saleItems: nextSaleItems,
      movements: nextMovements,
      stock,
      deletedMovementIds: [...nextDeletedMovementIds],
      deletedSaleItemKeys: [...nextDeletedSaleItemKeys],
    }),
  );
}
function saveProducts(nextProducts = products) {
  localStorage.setItem(productStorageKey, JSON.stringify(nextProducts));
}
function restoreProducts() {
  try {
    const saved = localStorage.getItem(productStorageKey);
    if (!saved) return;

    const state = JSON.parse(saved);
    const productIds = new Set();
    if (!Array.isArray(state)) {
      throw new Error("Saved product data is invalid.");
    }

    const invalidProduct = state.some((product) => {
      if (
        !product ||
        !Number.isInteger(product.product_id) ||
        productIds.has(product.product_id)
      ) {
        return true;
      }
      productIds.add(product.product_id);
      return (
        !Number.isInteger(product.category_id) ||
        !categories[product.category_id] ||
        typeof product.product_name !== "string" ||
        typeof product.sku !== "string" ||
        !Number.isFinite(product.unit_price) ||
        product.unit_price < 0 ||
        !Number.isFinite(product.cost_price) ||
        product.cost_price < 0 ||
        !Number.isInteger(product.stock_quantity) ||
        product.stock_quantity < 0 ||
        !Number.isInteger(product.reorder_level) ||
        product.reorder_level < 0 ||
        !["Active", "Inactive"].includes(product.status)
      );
    });
    if (invalidProduct) throw new Error("Saved product data is invalid.");

    products.splice(0, products.length, ...state);
  } catch (error) {
    window.alert(`Could not load saved product data: ${error.message}`);
  }
}
function saveSupplierData(nextSuppliers = suppliers, nextProductSuppliers = productSuppliers) {
  localStorage.setItem(
    supplierStorageKey,
    JSON.stringify({
      suppliers: nextSuppliers,
      productSuppliers: nextProductSuppliers,
    }),
  );
}
function restoreSupplierData() {
  try {
    const saved = localStorage.getItem(supplierStorageKey);
    if (!saved) return;

    const state = JSON.parse(saved);
    if (
      !state ||
      !Array.isArray(state.suppliers) ||
      !Array.isArray(state.productSuppliers)
    ) {
      throw new Error("Saved supplier data has an unexpected format.");
    }

    const supplierIds = new Set();
    const invalidSupplier = state.suppliers.some((supplier) => {
      if (
        !supplier ||
        !Number.isInteger(supplier.supplier_id) ||
        supplierIds.has(supplier.supplier_id)
      ) {
        return true;
      }
      supplierIds.add(supplier.supplier_id);
      return (
        typeof supplier.supplier_name !== "string" ||
        !supplier.supplier_name.trim() ||
        typeof supplier.contact_number !== "string" ||
        typeof supplier.email !== "string" ||
        typeof supplier.address !== "string"
      );
    });
    const productSupplierKeys = new Set();
    const invalidProductSupplier = state.productSuppliers.some((entry) => {
      if (
        !entry ||
        !Number.isInteger(entry.product_id) ||
        !Number.isInteger(entry.supplier_id) ||
        !supplierIds.has(entry.supplier_id)
      ) {
        return true;
      }
      const key = `${entry.product_id}:${entry.supplier_id}`;
      if (productSupplierKeys.has(key)) return true;
      productSupplierKeys.add(key);
      return (
        typeof entry.supplier_product_code !== "string" ||
        !Number.isFinite(entry.supply_price) ||
        entry.supply_price < 0
      );
    });
    if (invalidSupplier || invalidProductSupplier) {
      throw new Error("Saved supplier data is invalid.");
    }

    suppliers.splice(0, suppliers.length, ...state.suppliers);
    productSuppliers.splice(
      0,
      productSuppliers.length,
      ...state.productSuppliers,
    );
  } catch (error) {
    window.alert(`Could not load saved supplier data: ${error.message}`);
  }
}
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
  return u ? u.first_name + " " + u.last_name : `User #${id}`;
};
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
          `<tr><td>${esc(p.product_name)}</td><td>${esc(p.sku)}</td><td>${categories[p.category_id]}</td><td>${money(p.unit_price)}</td><td>${money(p.cost_price)}</td><td>${p.stock_quantity}</td><td><span class="pill ${p.status === "Inactive" ? "inactive" : "good"}">${esc(p.status || "Active")}</span>${p.stock_quantity === 0 ? ' <span class="pill out-of-stock">Out of stock</span>' : p.stock_quantity <= p.reorder_level ? ' <span class="pill low">Low stock</span>' : ""}</td><td><button class="primary-btn update-btn" type="button" data-update-product="${p.product_id}" aria-label="Update ${esc(p.product_name)}">Update</button> <button class="delete-btn" type="button" data-delete-product="${p.product_id}" aria-label="Delete ${esc(p.product_name)}">Delete</button></td></tr>`,
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

  const updatedProducts = products.filter((item) => item.product_id !== productId);
  saveProducts(updatedProducts);
  products.splice(productIndex, 1);
  renderProducts();
}
function openProductUpdate(productId) {
  const product = products.find((item) => item.product_id === productId);
  if (!product) return;

  const form = document.getElementById("product-update-form");
  form.elements.unit_price.value = product.unit_price;
  form.elements.cost_price.value = product.cost_price;
  form.elements.stock_quantity.value = product.stock_quantity;
  form.elements.status.value = product.status || "Active";
  form.dataset.productId = productId;
  document.getElementById("update-product-name").textContent =
    `Update details for ${product.product_name}.`;
  document.getElementById("update-form-error").textContent = "";
  document.getElementById("product-update-dialog").showModal();
}
function updateProduct(form) {
  const productId = Number(form.dataset.productId);
  const product = products.find((item) => item.product_id === productId);
  if (!product) return;

  const data = Object.fromEntries(new FormData(form));
  const unitPrice = Number(data.unit_price);
  const costPrice = Number(data.cost_price);
  const stockQuantity = Number(data.stock_quantity);
  if (
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    !Number.isFinite(costPrice) ||
    costPrice < 0 ||
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0
  ) {
    document.getElementById("update-form-error").textContent =
      "Enter valid prices and a whole, non-negative stock quantity.";
    return;
  }

  const updatedProduct = {
    ...product,
    unit_price: unitPrice,
    cost_price: costPrice,
    stock_quantity: stockQuantity,
    status: data.status,
  };
  const updatedProducts = products.map((item) =>
    item.product_id === productId ? updatedProduct : item,
  );
  const stockChange = stockQuantity - product.stock_quantity;
  let movement = null;
  if (stockChange !== 0) {
    const now = new Date();
    const movementDate = [
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
    ].join(" ");
    movement = {
      movement_id: nextMovementId(),
      product_id: productId,
      user_id: window.authContext.user.user_id,
      movement_type: stockChange > 0 ? "STOCK_IN" : "STOCK_OUT",
      quantity: Math.abs(stockChange),
      movement_date: movementDate,
      reference_number: `PRODUCT-UPDATE-${productId}`,
    };
  }
  try {
    saveProducts(updatedProducts);
    if (movement) {
      saveTransactions(
        [...addedSales],
        [...addedSaleItems],
        [...addedMovements, movement],
        updatedProducts.map(({ product_id, stock_quantity }) => ({
          product_id,
          stock_quantity,
        })),
      );
    }
  } catch (error) {
    document.getElementById("update-form-error").textContent =
      `Could not save product changes: ${error.message}`;
    return;
  }

  Object.assign(product, updatedProduct);
  if (movement) {
    movements.push(movement);
    addedMovements.push(movement);
  }
  document.getElementById("product-update-dialog").close();
  renderProducts();
}
function renderMovements() {
  const filter = document.getElementById("movement-filter").value;
  document.getElementById("movements-table").innerHTML = [...movements]
    .reverse()
    .filter((m) => !filter || m.movement_type === filter)
    .map(
      (m) =>
      `<tr><td>${m.movement_id}</td><td>${esc(productName(m.product_id))}</td><td><span class="pill ${m.movement_type.toLowerCase()}">${m.movement_type.replace("_", " ")}</span></td><td>${m.movement_type === "STOCK_OUT" ? "−" : m.movement_type === "STOCK_IN" ? "+" : ""}${m.quantity} units</td><td>${esc(userName(m.user_id))}</td><td>${m.movement_date}</td><td>${esc(m.reference_number)}</td><td><button class="delete-btn" type="button" data-delete-movement="${m.movement_id}" aria-label="Delete movement ${m.movement_id}">Delete</button></td></tr>`,
    )
    .join("");
  const clearButton = document.getElementById("clear-movements-btn");
  if (clearButton) clearButton.disabled = movements.length === 0;
}
function removeMovementHistory(movementIds) {
  const idsToDelete = new Set(
    movementIds.filter((movementId) =>
    movements.some((movement) => movement.movement_id === movementId),
    ),
  );
  if (idsToDelete.size === 0) return;

  const nextDeletedMovementIds = new Set(deletedMovementIds);
  idsToDelete.forEach((movementId) =>
    nextDeletedMovementIds.add(movementId),
  );
  const nextAddedMovements = addedMovements.filter(
    (movement) => !idsToDelete.has(movement.movement_id),
  );
  const stock = products.map(({ product_id, stock_quantity }) => ({
    product_id,
    stock_quantity,
  }));
  try {
    saveTransactions(
    [...addedSales],
    [...addedSaleItems],
    nextAddedMovements,
    stock,
    nextDeletedMovementIds,
    );
  } catch (error) {
    window.alert(`Could not delete movement history: ${error.message}`);
    return;
  }

  idsToDelete.forEach((movementId) =>
    deletedMovementIds.add(movementId),
  );
  movements.splice(
    0,
    movements.length,
    ...movements.filter(
    (movement) => !idsToDelete.has(movement.movement_id),
    ),
  );
  addedMovements.splice(0, addedMovements.length, ...nextAddedMovements);
  renderMovements();
}
function deleteMovement(movementId) {
  if (!movements.some((movement) => movement.movement_id === movementId))
    return;
  if (
    !window.confirm(
    `Delete movement #${movementId} from history? This will not change stock.`,
    )
  ) {
    return;
  }
  removeMovementHistory([movementId]);
}
function clearMovementHistory() {
  if (movements.length === 0) return;
  if (
    !window.confirm(
    `Delete all ${movements.length} movement records from history? This will not change stock.`,
    )
  ) {
    return;
  }
  removeMovementHistory(movements.map((movement) => movement.movement_id));
}
function renderSalesCart() {
  const productTable = document.getElementById("sales-products-table");
  if (!productTable) return;

  productTable.innerHTML =
    products
      .filter((product) => product.status !== "Inactive")
      .map(
        (product) =>
          `<tr><td>${esc(product.product_name)}</td><td>${money(product.unit_price)}</td><td>${product.stock_quantity}</td><td><input class="cart-quantity" type="number" min="1" max="${product.stock_quantity}" value="1" aria-label="Quantity of ${esc(product.product_name)}" ${product.stock_quantity === 0 ? "disabled" : ""}></td><td><button class="primary-btn add-to-cart-btn" type="button" data-add-to-cart="${product.product_id}" ${product.stock_quantity === 0 ? "disabled" : ""}>Add to Cart</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="5">No products available.</td></tr>';

  const cartTable = document.getElementById("cart-table");
  cartTable.innerHTML =
    [...cart.entries()]
      .map(([productId, item]) => {
        const product = products.find((entry) => entry.product_id === productId);
        return `<tr><td>${esc(product.product_name)}</td><td>${item.quantity}</td><td>${money(item.unit_price)}</td><td>${money(item.quantity * item.unit_price)}</td><td><button class="delete-btn" type="button" data-remove-from-cart="${productId}">Remove</button></td></tr>`;
      })
      .join("") || '<tr><td colspan="5">Your cart is empty.</td></tr>';

  const total = [...cart.values()].reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );
  document.getElementById("cart-total").textContent = money(total);
  document.getElementById("checkout-btn").disabled = cart.size === 0;
}
function addToCart(productId, quantity) {
  const product = products.find((item) => item.product_id === productId);
  const currentQuantity = cart.get(productId)?.quantity || 0;
  if (
    !product ||
    product.status === "Inactive" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    currentQuantity + quantity > product.stock_quantity
  ) {
    document.getElementById("cart-message").textContent =
      "Enter a valid quantity that does not exceed available stock.";
    return;
  }

  cart.set(productId, {
    quantity: currentQuantity + quantity,
    unit_price: product.unit_price,
  });
  document.getElementById("cart-message").textContent = "";
  renderSalesCart();
}
function completeSale() {
  const message = document.getElementById("cart-message");
  const items = [...cart.entries()];
  if (!items.length) return;

  for (const [productId, item] of items) {
    const product = products.find((entry) => entry.product_id === productId);
    if (
      !product ||
      product.status === "Inactive" ||
      item.quantity > product.stock_quantity
    ) {
      message.textContent =
        "Stock changed while this cart was open. Update the cart quantities and try again.";
      renderSalesCart();
      return;
    }
  }

  const lastReferencedSaleId = movements.reduce((lastId, movement) => {
    const match = String(movement.reference_number || "").match(/^SALE-(\d+)$/);
    return match ? Math.max(lastId, Number(match[1])) : lastId;
  }, 0);
  const saleId =
    Math.max(
      ...sales.map((sale) => sale.sale_id),
      lastReferencedSaleId,
      0,
    ) + 1;
  const reference = `SALE-${String(saleId).padStart(3, "0")}`;
  const now = new Date();
  const saleDate = [
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
  ].join(" ");
  const total = items.reduce(
    (sum, [, item]) => sum + item.quantity * item.unit_price,
    0,
  );
  const sale = {
    sale_id: saleId,
    user_id: window.authContext.user.user_id,
    customer_id: 0,
    sale_date: saleDate,
    discount: 0,
    total_amount: total,
  };
  const newSaleItems = items.map(([productId, item]) => ({
    sale_id: saleId,
    product_id: productId,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: 0,
    subtotal: item.quantity * item.unit_price,
  }));
  const newMovements = items.map(([productId, item], index) => ({
    movement_id:
      nextMovementId() + index,
    product_id: productId,
    user_id: window.authContext.user.user_id,
    movement_type: "STOCK_OUT",
    quantity: item.quantity,
    movement_date: saleDate,
    reference_number: reference,
  }));
  const stock = products.map((product) => ({
    product_id: product.product_id,
    stock_quantity:
      product.stock_quantity -
      (cart.get(product.product_id)?.quantity || 0),
  }));

  try {
    saveTransactions(
      [...addedSales, sale],
      [...addedSaleItems, ...newSaleItems],
      [...addedMovements, ...newMovements],
      stock,
    );
    saveProducts(
      products.map((product) => ({
        ...product,
        stock_quantity: stock.find(
          (item) => item.product_id === product.product_id,
        ).stock_quantity,
      })),
    );
  } catch (error) {
    message.textContent = `Could not save this sale: ${error.message}`;
    return;
  }

  sales.push(sale);
  saleItems.push(...newSaleItems);
  movements.push(...newMovements);
  addedSales.push(sale);
  addedSaleItems.push(...newSaleItems);
  addedMovements.push(...newMovements);
  stock.forEach(({ product_id, stock_quantity }) => {
    products.find((product) => product.product_id === product_id).stock_quantity =
      stock_quantity;
  });
  cart.clear();
  message.textContent = `${reference} completed. Inventory has been reduced.`;
  renderSalesCart();
  renderOtherTables();
}
function renderOtherTables() {
  const saleItemsTable = document.getElementById("sale-items-table");
  if (saleItemsTable) {
    saleItemsTable.innerHTML =
      saleItems
        .map(
          (i) =>
            `<tr><td>#${i.sale_id}</td><td>${esc(productName(i.product_id))}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.discount)}</td><td>${money(i.subtotal)}</td><td><button class="delete-btn" type="button" data-delete-sale-item="${i.sale_id}" data-product-id="${i.product_id}" aria-label="Delete ${esc(productName(i.product_id))} from sale ${i.sale_id}">Delete</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="7">No sale item history.</td></tr>';
    const clearSaleItemsButton = document.getElementById(
      "clear-sale-items-btn",
    );
    if (clearSaleItemsButton)
      clearSaleItemsButton.disabled = saleItems.length === 0;
  }
  const suppliersTable = document.getElementById("suppliers-table");
  if (suppliersTable)
    suppliersTable.innerHTML = suppliers
      .map(
        (s) =>
          `<tr><td>${s.supplier_id}</td><td>${esc(s.supplier_name)}</td><td>${esc(s.contact_number)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td><td><button class="delete-btn" type="button" data-delete-supplier="${s.supplier_id}" aria-label="Delete supplier ${esc(s.supplier_name)}">Delete</button></td></tr>`,
      )
      .join("");
  const productSuppliersTable = document.getElementById(
    "product-suppliers-table",
  );
  if (productSuppliersTable)
    productSuppliersTable.innerHTML = productSuppliers
      .map(
        (x) =>
          `<tr><td>${esc(productName(x.product_id))}</td><td>${esc(supplierName(x.supplier_id))}</td><td>${esc(x.supplier_product_code)}</td><td>${money(x.supply_price)}</td><td><button class="primary-btn update-btn" type="button" data-edit-product-supplier="${x.product_id}" data-supplier-id="${x.supplier_id}" aria-label="Edit supplier for ${esc(productName(x.product_id))}">Edit</button> <button class="delete-btn" type="button" data-delete-product-supplier="${x.product_id}" data-supplier-id="${x.supplier_id}" aria-label="Delete supplier link for ${esc(productName(x.product_id))}">Delete</button></td></tr>`,
      )
      .join("");
  const usersTable = document.getElementById("users-table");
  if (usersTable)
    usersTable.innerHTML = users
      .map(
        (u) =>
          `<tr><td>${u.user_id}</td><td>${esc(u.first_name + " " + u.last_name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td><span class="pill ${u.is_active ? "good" : "inactive"}">${u.is_active ? "Active" : "Inactive"}</span></td><td>${esc(window.passwordStatusFor(u))}</td><td><button class="primary-btn update-btn" type="button" data-edit-user="${u.user_id}">Edit</button> <button class="delete-btn" type="button" data-delete-user="${u.user_id}">Delete</button></td></tr>`,
      )
      .join("");
}
function openProductSupplierEditor(productId, supplierId) {
  const mappingIndex = productSuppliers.findIndex(
    (entry) =>
      entry.product_id === productId && entry.supplier_id === supplierId,
  );
  if (mappingIndex === -1) return;

  const mapping = productSuppliers[mappingIndex];
  const form = document.getElementById("product-supplier-form");
  const productSelect = form.elements.product_id;
  const supplierSelect = form.elements.supplier_id;
  productSelect.innerHTML = products
    .map(
      (product) =>
        `<option value="${product.product_id}">${esc(product.product_name)}</option>`,
    )
    .join("");
  if (!products.some((product) => product.product_id === mapping.product_id)) {
    productSelect.insertAdjacentHTML(
      "afterbegin",
      `<option value="${mapping.product_id}">${esc(productName(mapping.product_id))}</option>`,
    );
  }
  supplierSelect.innerHTML = suppliers
    .map(
      (supplier) =>
        `<option value="${supplier.supplier_id}">${esc(supplier.supplier_name)}</option>`,
    )
    .join("");
  productSelect.value = mapping.product_id;
  supplierSelect.value = mapping.supplier_id;
  form.elements.supplier_product_code.value = mapping.supplier_product_code;
  form.elements.supply_price.value = mapping.supply_price;
  form.dataset.mappingIndex = mappingIndex;
  document.getElementById("product-supplier-form-error").textContent = "";
  document.getElementById("product-supplier-dialog").showModal();
}
function addSupplier(form) {
  const data = Object.fromEntries(new FormData(form));
  const supplierNameInput = data.supplier_name.trim();
  if (
    suppliers.some(
      (supplier) =>
        supplier.supplier_name.toLowerCase() === supplierNameInput.toLowerCase(),
    )
  ) {
    document.getElementById("supplier-form-error").textContent =
      "That supplier already exists.";
    return;
  }

  const supplier = {
    supplier_id: Math.max(...suppliers.map((entry) => entry.supplier_id), 0) + 1,
    supplier_name: supplierNameInput,
    contact_number: data.contact_number.trim(),
    email: data.email.trim(),
    address: data.address.trim(),
  };
  try {
    saveSupplierData([...suppliers, supplier]);
  } catch (error) {
    document.getElementById("supplier-form-error").textContent =
      `Could not save supplier: ${error.message}`;
    return;
  }

  suppliers.push(supplier);
  form.reset();
  document.getElementById("supplier-dialog").close();
  renderOtherTables();
}
function updateProductSupplier(form) {
  const mappingIndex = Number(form.dataset.mappingIndex);
  const currentMapping = productSuppliers[mappingIndex];
  if (!currentMapping) return;

  const data = Object.fromEntries(new FormData(form));
  const productId = Number(data.product_id);
  const supplierId = Number(data.supplier_id);
  const supplyPrice = Number(data.supply_price);
  const supplierProductCode = data.supplier_product_code.trim();
  if (
    (!products.some((product) => product.product_id === productId) &&
      productId !== currentMapping.product_id) ||
    !suppliers.some((supplier) => supplier.supplier_id === supplierId) ||
    !supplierProductCode ||
    !Number.isFinite(supplyPrice) ||
    supplyPrice < 0
  ) {
    document.getElementById("product-supplier-form-error").textContent =
      "Enter a valid product, supplier, product code, and non-negative price.";
    return;
  }
  if (
    productSuppliers.some(
      (entry, index) =>
        index !== mappingIndex &&
        entry.product_id === productId &&
        entry.supplier_id === supplierId,
    )
  ) {
    document.getElementById("product-supplier-form-error").textContent =
      "That product is already linked to this supplier.";
    return;
  }

  const updatedMapping = {
    product_id: productId,
    supplier_id: supplierId,
    supplier_product_code: supplierProductCode,
    supply_price: supplyPrice,
  };
  const updatedMappings = productSuppliers.map((entry, index) =>
    index === mappingIndex ? updatedMapping : entry,
  );
  try {
    saveSupplierData(suppliers, updatedMappings);
  } catch (error) {
    document.getElementById("product-supplier-form-error").textContent =
      `Could not save product supplier changes: ${error.message}`;
    return;
  }

  Object.assign(currentMapping, updatedMapping);
  document.getElementById("product-supplier-dialog").close();
  renderOtherTables();
}
function deleteSupplier(supplierId) {
  const supplierIndex = suppliers.findIndex(
    (supplier) => supplier.supplier_id === supplierId,
  );
  if (supplierIndex === -1) return;

  const supplier = suppliers[supplierIndex];
  const linkedMappings = productSuppliers.filter(
    (entry) => entry.supplier_id === supplierId,
  );
  const mappingMessage = linkedMappings.length
    ? ` and its ${linkedMappings.length} product supplier link(s)`
    : "";
  if (
    !window.confirm(
      `Delete "${supplier.supplier_name}"${mappingMessage}? This cannot be undone.`,
    )
  ) {
    return;
  }

  const nextSuppliers = suppliers.filter(
    (entry) => entry.supplier_id !== supplierId,
  );
  const nextProductSuppliers = productSuppliers.filter(
    (entry) => entry.supplier_id !== supplierId,
  );
  try {
    saveSupplierData(nextSuppliers, nextProductSuppliers);
  } catch (error) {
    window.alert(`Could not delete supplier: ${error.message}`);
    return;
  }

  suppliers.splice(supplierIndex, 1);
  productSuppliers.splice(
    0,
    productSuppliers.length,
    ...nextProductSuppliers,
  );
  renderOtherTables();
}
function deleteProductSupplier(productId, supplierId) {
  const mappingIndex = productSuppliers.findIndex(
    (entry) =>
      entry.product_id === productId && entry.supplier_id === supplierId,
  );
  if (mappingIndex === -1) return;

  if (
    !window.confirm(
      `Delete the supplier link for ${productName(productId)}? This will not change product stock.`,
    )
  ) {
    return;
  }

  const nextProductSuppliers = productSuppliers.filter(
    (entry) =>
      !(entry.product_id === productId && entry.supplier_id === supplierId),
  );
  try {
    saveSupplierData(suppliers, nextProductSuppliers);
  } catch (error) {
    window.alert(`Could not delete product supplier link: ${error.message}`);
    return;
  }

  productSuppliers.splice(
    0,
    productSuppliers.length,
    ...nextProductSuppliers,
  );
  renderOtherTables();
}
function removeSaleItemHistory(itemsToRemove) {
  const keysToDelete = new Set(
    itemsToRemove
      .map(saleItemKey)
      .filter((itemKey) =>
        saleItems.some((item) => saleItemKey(item) === itemKey),
      ),
  );
  if (keysToDelete.size === 0) return;

  const nextDeletedSaleItemKeys = new Set(deletedSaleItemKeys);
  keysToDelete.forEach((itemKey) => nextDeletedSaleItemKeys.add(itemKey));
  const nextAddedSaleItems = addedSaleItems.filter(
    (item) => !keysToDelete.has(saleItemKey(item)),
  );
  const stock = products.map(({ product_id, stock_quantity }) => ({
    product_id,
    stock_quantity,
  }));
  try {
    saveTransactions(
      [...addedSales],
      nextAddedSaleItems,
      [...addedMovements],
      stock,
      deletedMovementIds,
      nextDeletedSaleItemKeys,
    );
  } catch (error) {
    window.alert(`Could not delete sale item history: ${error.message}`);
    return;
  }

  keysToDelete.forEach((itemKey) => deletedSaleItemKeys.add(itemKey));
  saleItems.splice(
    0,
    saleItems.length,
    ...saleItems.filter((item) => !keysToDelete.has(saleItemKey(item))),
  );
  addedSaleItems.splice(0, addedSaleItems.length, ...nextAddedSaleItems);
  renderOtherTables();
}
function deleteSaleItem(saleId, productId) {
  const item = saleItems.find(
    (saleItem) =>
      saleItem.sale_id === saleId && saleItem.product_id === productId,
  );
  if (!item) return;
  if (
    !window.confirm(
      `Delete ${productName(productId)} from sale #${saleId} history? This will not change stock or sales totals.`,
    )
  ) {
    return;
  }
  removeSaleItemHistory([item]);
}
function clearSaleItemHistory() {
  if (saleItems.length === 0) return;
  if (
    !window.confirm(
      `Delete all ${saleItems.length} sale item records from history? This will not change stock or sales totals.`,
    )
  ) {
    return;
  }
  removeSaleItemHistory([...saleItems]);
}
const supplierDialog = document.getElementById("supplier-dialog");
if (supplierDialog) {
  const supplierForm = document.getElementById("supplier-form");
  document
    .getElementById("add-supplier-btn")
    .addEventListener("click", () => {
      supplierForm.reset();
      document.getElementById("supplier-form-error").textContent = "";
      supplierDialog.showModal();
    });
  document
    .getElementById("close-supplier-dialog")
    .addEventListener("click", () => supplierDialog.close());
  supplierForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addSupplier(event.currentTarget);
  });
}
const productSupplierDialog = document.getElementById("product-supplier-dialog");
if (productSupplierDialog) {
  document
    .getElementById("close-product-supplier-dialog")
    .addEventListener("click", () => productSupplierDialog.close());
  document
    .getElementById("product-supplier-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      updateProductSupplier(event.currentTarget);
    });
}
const productSuppliersTable = document.getElementById(
  "product-suppliers-table",
);
if (productSuppliersTable) {
  productSuppliersTable.addEventListener("click", (event) => {
    const editButton = event.target.closest(
      "button[data-edit-product-supplier]",
    );
    const deleteButton = event.target.closest(
      "button[data-delete-product-supplier]",
    );
    if (editButton) {
      openProductSupplierEditor(
        Number(editButton.dataset.editProductSupplier),
        Number(editButton.dataset.supplierId),
      );
    }
    if (deleteButton) {
      deleteProductSupplier(
        Number(deleteButton.dataset.deleteProductSupplier),
        Number(deleteButton.dataset.supplierId),
      );
    }
  });
}
const suppliersDirectoryTable = document.getElementById("suppliers-table");
if (suppliersDirectoryTable) {
  suppliersDirectoryTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("button[data-delete-supplier]");
    if (deleteButton)
      deleteSupplier(Number(deleteButton.dataset.deleteSupplier));
  });
}
const productSearch = document.getElementById("product-search");
if (productSearch) productSearch.addEventListener("input", renderProducts);
const productsTable = document.getElementById("products-table");
if (productsTable) {
  productsTable.addEventListener("click", (event) => {
    const updateButton = event.target.closest("button[data-update-product]");
    const deleteButton = event.target.closest("button[data-delete-product]");
    if (updateButton)
      openProductUpdate(Number(updateButton.dataset.updateProduct));
    if (deleteButton) deleteProduct(Number(deleteButton.dataset.deleteProduct));
  });
}
const categoryFilter = document.getElementById("category-filter");
if (categoryFilter) categoryFilter.addEventListener("change", renderProducts);
const movementFilter = document.getElementById("movement-filter");
if (movementFilter) movementFilter.addEventListener("change", renderMovements);
const clearMovementsButton = document.getElementById("clear-movements-btn");
if (clearMovementsButton)
  clearMovementsButton.addEventListener("click", clearMovementHistory);
const movementsTable = document.getElementById("movements-table");
if (movementsTable) {
  movementsTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("button[data-delete-movement]");
    if (deleteButton)
      deleteMovement(Number(deleteButton.dataset.deleteMovement));
  });
}
const salesProductsTable = document.getElementById("sales-products-table");
if (salesProductsTable) {
  salesProductsTable.addEventListener("click", (event) => {
    const addButton = event.target.closest("button[data-add-to-cart]");
    if (addButton) {
      const quantityInput = addButton
        .closest("tr")
        .querySelector(".cart-quantity");
      addToCart(
        Number(addButton.dataset.addToCart),
        Number(quantityInput.value),
      );
    }
  });
}
const cartTable = document.getElementById("cart-table");
if (cartTable) {
  cartTable.addEventListener("click", (event) => {
    const removeButton = event.target.closest("button[data-remove-from-cart]");
    if (removeButton) {
      cart.delete(Number(removeButton.dataset.removeFromCart));
      document.getElementById("cart-message").textContent = "";
      renderSalesCart();
    }
  });
  document
    .getElementById("checkout-btn")
    .addEventListener("click", completeSale);
}
const saleItemsHistoryTable = document.getElementById("sale-items-table");
if (saleItemsHistoryTable) {
  saleItemsHistoryTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("button[data-delete-sale-item]");
    if (deleteButton) {
      deleteSaleItem(
        Number(deleteButton.dataset.deleteSaleItem),
        Number(deleteButton.dataset.productId),
      );
    }
  });
  document
    .getElementById("clear-sale-items-btn")
    .addEventListener("click", clearSaleItemHistory);
}
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
    const newProduct = {
      product_id: Math.max(...products.map((p) => p.product_id), 0) + 1,
      category_id: Number(data.category_id),
      product_name: data.product_name.trim(),
      sku,
      unit_price: Number(data.unit_price),
      cost_price: Number(data.cost_price),
      status: "Active",
      stock_quantity: Number(data.stock_quantity),
      reorder_level: Number(data.reorder_level),
    };
    try {
      saveProducts([...products, newProduct]);
    } catch (error) {
      document.getElementById("form-error").textContent =
        `Could not save product: ${error.message}`;
      return;
    }
    products.push(newProduct);
    e.currentTarget.reset();
    dialog.close();
    renderProducts();
  });
}
const productUpdateDialog = document.getElementById("product-update-dialog");
if (productUpdateDialog) {
  document
    .getElementById("close-update-dialog")
    .addEventListener("click", () => productUpdateDialog.close());
  document
    .getElementById("product-update-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      updateProduct(event.currentTarget);
    });
}
restoreTransactions();
restoreProducts();
restoreSupplierData();
const page = document.body.dataset.page;
if (page === "dashboard") renderDashboard();
if (page === "products") renderProducts();
if (page === "movements") renderMovements();
if (page === "sales") renderSalesCart();
renderOtherTables();
window.renderOtherTables = renderOtherTables;
window.refreshUsersTable = () => {
  users = window.getAppUsers();
  renderOtherTables();
};
