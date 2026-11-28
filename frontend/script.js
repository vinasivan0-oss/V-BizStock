// VBizStock frontend: every page loads and saves data through the Node/Express + PostgreSQL API.
(() => {
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);
  const api = window.api;
  const me = window.authContext.user;
  const isStaff = me.role === "Staff";

  const money = (n) =>
    "₱" +
    Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const on = (id, event, handler) => {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  };
  const setText = (id, message) => {
    const el = $(id);
    if (el) el.textContent = message || "";
  };
  function pageError(message) {
    let el = $("page-error");
    if (!el) {
      el = document.createElement("p");
      el.id = "page-error";
      el.className = "form-error";
      el.setAttribute("role", "alert");
      document.querySelector(".view").prepend(el);
    }
    el.textContent = message || "";
  }
  // Wrap a click/submit handler so server errors show up instead of failing silently.
  const guard = (fn, onError = (m) => pageError(m)) => async (...args) => {
    try {
      pageError("");
      await fn(...args);
    } catch (error) {
      onError(error.message);
    }
  };

  /* ------------------------------ state ------------------------------ */
  let categories = [];
  let products = [];
  let suppliers = [];
  let productSuppliers = [];
  let users = [];
  let movements = [];
  let saleItems = [];
  const cart = new Map();

  const loadCategories = async () => (categories = await api("GET", "/api/categories"));
  const loadProducts = async () => (products = await api("GET", "/api/products"));
  const loadSuppliers = async () => {
    [suppliers, productSuppliers] = await Promise.all([
      api("GET", "/api/suppliers"),
      api("GET", "/api/product-suppliers"),
    ]);
  };
  const loadUsers = async () => (users = await api("GET", "/api/users"));
  const loadMovements = async () => (movements = await api("GET", "/api/movements"));
  const loadSaleItems = async () => (saleItems = await api("GET", "/api/sales/items"));

  const categoryOptions = (selected) =>
    categories
      .map(
        (c) =>
          `<option value="${c.category_id}" ${c.category_id === selected ? "selected" : ""}>${esc(c.category_name)}</option>`,
      )
      .join("");
  const productOptions = () =>
    products.map((p) => `<option value="${p.product_id}">${esc(p.product_name)}</option>`).join("");

  /* ----------------------------- dashboard ----------------------------- */
  async function renderDashboard() {
    const d = await api("GET", "/api/dashboard");
    setText("stat-products", d.products);
    setText("stat-sales", money(d.total_sales));
    setText("stat-movements", d.movements);
    setText("stat-low", d.low_stock);
    const reset = $("reset-sales-btn");
    if (reset) reset.disabled = d.total_sales === 0;
    setText(
      "today-label",
      new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
    );
    $("recent-movements").innerHTML =
      d.recent_movements
        .map(
          (m) =>
            `<tr><td>${esc(m.product_name)}</td><td><span class="pill ${m.movement_type.toLowerCase()}">${m.movement_type.replace("_", " ")}</span></td><td>${m.quantity}</td><td>${esc(m.movement_date.slice(0, 10))}</td></tr>`,
        )
        .join("") || '<tr><td colspan="4">No inventory movements yet.</td></tr>';
    $("stock-overview").innerHTML =
      d.stock_overview
        .map((p) => {
          const pct = Math.min(100, (p.stock_quantity / Math.max(p.reorder_level * 3, 1)) * 100);
          return `<div><div class="stock-item-head"><strong>${esc(p.product_name)}</strong><span>${p.stock_quantity} units</span></div><div class="progress"><span style="width:${pct}%"></span></div></div>`;
        })
        .join("") || "<p>No products yet. Add products to see stock levels.</p>";
  }

  /* ------------------------------ products ------------------------------ */
  function renderProductFilters() {
    const filter = $("category-filter");
    const current = filter.value;
    filter.innerHTML =
      '<option value="">All categories</option>' +
      categories.map((c) => `<option value="${c.category_id}">${esc(c.category_name)}</option>`).join("");
    filter.value = categories.some((c) => String(c.category_id) === current) ? current : "";
  }

  function renderProducts() {
    const q = $("product-search").value.toLowerCase();
    const cat = $("category-filter").value;
    const rows = products.filter(
      (p) =>
        (p.product_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
        (!cat || String(p.category_id) === cat),
    );
    $("products-table").innerHTML =
      rows
        .map(
          (p) =>
            `<tr><td>${esc(p.product_name)}</td><td>${esc(p.sku)}</td><td>${esc(p.category_name)}</td><td>${money(p.unit_price)}</td><td>${money(p.cost_price)}</td><td>${p.stock_quantity}</td><td><span class="pill ${p.status === "Inactive" ? "inactive" : "good"}">${p.status}</span>${p.stock_quantity === 0 ? ' <span class="pill out-of-stock">Out of stock</span>' : p.stock_quantity <= p.reorder_level ? ' <span class="pill low">Low stock</span>' : ""}</td><td><button class="primary-btn update-btn" type="button" data-update-product="${p.product_id}">Update</button> <button class="delete-btn" type="button" data-delete-product="${p.product_id}">Delete</button></td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="8">${products.length ? "No products match your search." : "No products yet. Click “Add Product” to create your first one."}</td></tr>`;
  }

  function renderCategoryList() {
    $("category-list").innerHTML =
      categories
        .map(
          (c) =>
            `<tr><td>${esc(c.category_name)}</td><td style="text-align:right"><button class="delete-btn" type="button" data-delete-category="${c.category_id}">Delete</button></td></tr>`,
        )
        .join("") || '<tr><td>No categories yet.</td></tr>';
  }

  function openAddProduct() {
    if (!categories.length) {
      pageError("Add at least one category first (click “Categories”).");
      return;
    }
    const form = $("product-form");
    form.reset();
    form.elements.category_id.innerHTML = categoryOptions();
    setText("form-error", "");
    $("product-dialog").showModal();
  }

  function openProductUpdate(productId) {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return;
    const form = $("product-update-form");
    form.dataset.productId = productId;
    form.elements.product_name.value = product.product_name;
    form.elements.sku.value = product.sku;
    form.elements.category_id.innerHTML = categoryOptions(product.category_id);
    form.elements.unit_price.value = product.unit_price;
    form.elements.cost_price.value = product.cost_price;
    form.elements.stock_quantity.value = product.stock_quantity;
    form.elements.reorder_level.value = product.reorder_level;
    form.elements.status.value = product.status;
    setText("update-product-name", `Update details for ${product.product_name}.`);
    setText("update-form-error", "");
    $("product-update-dialog").showModal();
  }

  function initProducts() {
    on("product-search", "input", renderProducts);
    on("category-filter", "change", renderProducts);
    on("add-product-btn", "click", openAddProduct);
    on("close-dialog", "click", () => $("product-dialog").close());
    on("close-update-dialog", "click", () => $("product-update-dialog").close());

    $("product-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("POST", "/api/products", Object.fromEntries(new FormData(event.currentTarget)));
        $("product-dialog").close();
        await loadProducts();
        renderProducts();
      } catch (error) {
        setText("form-error", error.message);
      }
    });

    $("product-update-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await api("PUT", `/api/products/${form.dataset.productId}`, Object.fromEntries(new FormData(form)));
        $("product-update-dialog").close();
        await loadProducts();
        renderProducts();
      } catch (error) {
        setText("update-form-error", error.message);
      }
    });

    $("products-table").addEventListener(
      "click",
      guard(async (event) => {
        const update = event.target.closest("button[data-update-product]");
        const del = event.target.closest("button[data-delete-product]");
        if (update) openProductUpdate(Number(update.dataset.updateProduct));
        if (del) {
          const id = Number(del.dataset.deleteProduct);
          const product = products.find((p) => p.product_id === id);
          if (!product || !window.confirm(`Delete "${product.product_name}"? This cannot be undone.`)) return;
          await api("DELETE", `/api/products/${id}`);
          await loadProducts();
          renderProducts();
        }
      }),
    );

    // Categories
    on("manage-categories-btn", "click", () => {
      $("category-form").reset();
      setText("category-form-error", "");
      renderCategoryList();
      $("category-dialog").showModal();
    });
    on("close-category-dialog", "click", () => $("category-dialog").close());
    $("category-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await api("POST", "/api/categories", { category_name: form.elements.category_name.value });
        form.reset();
        setText("category-form-error", "");
        await loadCategories();
        renderCategoryList();
        renderProductFilters();
      } catch (error) {
        setText("category-form-error", error.message);
      }
    });
    $("category-list").addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-delete-category]");
      if (!button) return;
      const category = categories.find((c) => c.category_id === Number(button.dataset.deleteCategory));
      if (!category || !window.confirm(`Delete category "${category.category_name}"?`)) return;
      try {
        await api("DELETE", `/api/categories/${category.category_id}`);
        setText("category-form-error", "");
        await loadCategories();
        renderCategoryList();
        renderProductFilters();
      } catch (error) {
        setText(
          "category-form-error",
          /used by other records/.test(error.message)
            ? "This category still has products. Move or delete those products first."
            : error.message,
        );
      }
    });

    renderProductFilters();
    renderProducts();
  }

  /* ------------------------------ movements ------------------------------ */
  function renderMovements() {
    const filter = $("movement-filter").value;
    $("movements-table").innerHTML =
      movements
        .filter((m) => !filter || m.movement_type === filter)
        .map((m) => {
          const sign = m.movement_type === "STOCK_OUT" ? "−" : "+";
          return `<tr><td>${m.movement_id}</td><td>${esc(m.product_name)}</td><td><span class="pill ${m.movement_type.toLowerCase()}">${m.movement_type.replace("_", " ")}</span></td><td>${sign}${m.quantity} units</td><td>${esc(m.user_name)}</td><td>${esc(m.movement_date)}</td><td>${esc(m.reference_number || "")}</td><td><button class="delete-btn" type="button" data-delete-movement="${m.movement_id}">Delete</button></td></tr>`;
        })
        .join("") || '<tr><td colspan="8">No inventory movements yet.</td></tr>';
    $("clear-movements-btn").disabled = movements.length === 0;
  }

  function initMovements() {
    on("movement-filter", "change", renderMovements);
    on(
      "add-movement-btn",
      "click",
      guard(async () => {
        await loadProducts();
        if (!products.length) {
          pageError("Add a product first before recording stock movements.");
          return;
        }
        const form = $("movement-form");
        form.reset();
        form.elements.product_id.innerHTML = productOptions();
        setText("movement-form-error", "");
        $("movement-dialog").showModal();
      }),
    );
    on("close-movement-dialog", "click", () => $("movement-dialog").close());
    $("movement-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("POST", "/api/movements", Object.fromEntries(new FormData(event.currentTarget)));
        $("movement-dialog").close();
        await loadMovements();
        renderMovements();
      } catch (error) {
        setText("movement-form-error", error.message);
      }
    });
    $("movements-table").addEventListener(
      "click",
      guard(async (event) => {
        const button = event.target.closest("button[data-delete-movement]");
        if (!button) return;
        const id = Number(button.dataset.deleteMovement);
        if (!window.confirm(`Delete movement #${id} from history? This will not change stock.`)) return;
        await api("DELETE", `/api/movements/${id}`);
        await loadMovements();
        renderMovements();
      }),
    );
    on(
      "clear-movements-btn",
      "click",
      guard(async () => {
        if (!movements.length) return;
        if (!window.confirm(`Delete all ${movements.length} movement records from history? This will not change stock.`))
          return;
        await api("DELETE", "/api/movements");
        await loadMovements();
        renderMovements();
      }),
    );
    renderMovements();
  }

  /* -------------------------------- sales -------------------------------- */
  function renderSales() {
    $("sale-creation").classList.toggle("hidden", !isStaff);
    $("sales-view-only-notice").classList.toggle("hidden", isStaff);
    if (isStaff) renderCart();
    renderSaleItems();
  }

  function renderCart() {
    $("sales-products-table").innerHTML =
      products
        .filter((p) => p.status !== "Inactive")
        .map(
          (p) =>
            `<tr><td>${esc(p.product_name)}</td><td>${money(p.unit_price)}</td><td>${p.stock_quantity}</td><td><input class="cart-quantity" type="number" min="1" max="${p.stock_quantity}" value="1" aria-label="Quantity of ${esc(p.product_name)}" ${p.stock_quantity === 0 ? "disabled" : ""}></td><td><button class="primary-btn add-to-cart-btn" type="button" data-add-to-cart="${p.product_id}" ${p.stock_quantity === 0 ? "disabled" : ""}>Add to Cart</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="5">No products available.</td></tr>';

    $("cart-table").innerHTML =
      [...cart.entries()]
        .map(([id, item]) => {
          const p = products.find((x) => x.product_id === id);
          return `<tr><td>${esc(p ? p.product_name : "Unknown")}</td><td>${item.quantity}</td><td>${money(item.unit_price)}</td><td>${money(item.quantity * item.unit_price)}</td><td><button class="delete-btn" type="button" data-remove-from-cart="${id}">Remove</button></td></tr>`;
        })
        .join("") || '<tr><td colspan="5">Your cart is empty.</td></tr>';

    const total = [...cart.values()].reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    setText("cart-total", money(total));
    $("checkout-btn").disabled = cart.size === 0;
  }

  function renderSaleItems() {
    $("sale-items-actions-header").classList.toggle("hidden", !isStaff);
    $("clear-sale-items-btn").classList.toggle("hidden", !isStaff);
    $("sale-items-table").innerHTML =
      saleItems
        .map(
          (i) =>
            `<tr><td>#${i.sale_id}</td><td>${esc(i.product_name)}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.discount)}</td><td>${money(i.subtotal)}</td>${isStaff ? `<td><button class="delete-btn" type="button" data-delete-sale-item="${i.sale_id}" data-product-id="${i.product_id}">Delete</button></td>` : ""}</tr>`,
        )
        .join("") || `<tr><td colspan="${isStaff ? 7 : 6}">No sales yet.</td></tr>`;
    $("clear-sale-items-btn").disabled = saleItems.length === 0;
  }

  function initSales() {
    if (isStaff) {
      $("sales-products-table").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-add-to-cart]");
        if (!button) return;
        const id = Number(button.dataset.addToCart);
        const quantity = Number(button.closest("tr").querySelector(".cart-quantity").value);
        const product = products.find((p) => p.product_id === id);
        const have = cart.get(id)?.quantity || 0;
        if (!product || !Number.isInteger(quantity) || quantity < 1 || have + quantity > product.stock_quantity) {
          setText("cart-message", "Enter a valid quantity that does not exceed available stock.");
          return;
        }
        cart.set(id, { quantity: have + quantity, unit_price: product.unit_price });
        setText("cart-message", "");
        renderCart();
      });
      $("cart-table").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-remove-from-cart]");
        if (!button) return;
        cart.delete(Number(button.dataset.removeFromCart));
        setText("cart-message", "");
        renderCart();
      });
      on("checkout-btn", "click", async () => {
        const button = $("checkout-btn");
        button.disabled = true;
        try {
          const result = await api("POST", "/api/sales", {
            items: [...cart.entries()].map(([product_id, item]) => ({ product_id, quantity: item.quantity })),
          });
          cart.clear();
          await Promise.all([loadProducts(), loadSaleItems()]);
          renderSales();
          setText("cart-message", `${result.reference} completed. Inventory has been reduced.`);
        } catch (error) {
          setText("cart-message", error.message);
          await loadProducts();
          for (const [id, item] of [...cart]) {
            const p = products.find((x) => x.product_id === id);
            if (!p || p.status === "Inactive" || item.quantity > p.stock_quantity) cart.delete(id);
          }
          renderCart();
        }
      });
      $("sale-items-table").addEventListener(
        "click",
        guard(async (event) => {
          const button = event.target.closest("button[data-delete-sale-item]");
          if (!button) return;
          const { deleteSaleItem: saleId, productId } = button.dataset;
          if (!window.confirm(`Delete this item from sale #${saleId} history? This will not change stock or sales totals.`))
            return;
          await api("DELETE", `/api/sales/items/${saleId}/${productId}`);
          await loadSaleItems();
          renderSaleItems();
        }),
      );
      on(
        "clear-sale-items-btn",
        "click",
        guard(async () => {
          if (!saleItems.length) return;
          if (!window.confirm(`Delete all ${saleItems.length} sale item records from history? This will not change stock or sales totals.`))
            return;
          await api("DELETE", "/api/sales/items");
          await loadSaleItems();
          renderSaleItems();
        }),
      );
    }
    renderSales();
  }

  /* ------------------------------ suppliers ------------------------------ */
  function renderSuppliers() {
    $("suppliers-table").innerHTML =
      suppliers
        .map(
          (s) =>
            `<tr><td>${s.supplier_id}</td><td>${esc(s.supplier_name)}</td><td>${esc(s.contact_number || "")}</td><td>${esc(s.email || "")}</td><td>${esc(s.address || "")}</td><td><button class="delete-btn" type="button" data-delete-supplier="${s.supplier_id}">Delete</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="6">No suppliers yet. Click “Add Supplier”.</td></tr>';
    $("product-suppliers-table").innerHTML =
      productSuppliers
        .map(
          (x) =>
            `<tr><td>${esc(x.product_name)}</td><td>${esc(x.supplier_name)}</td><td>${esc(x.supplier_product_code)}</td><td>${money(x.supply_price)}</td><td><button class="primary-btn update-btn" type="button" data-edit-product-supplier="${x.product_id}" data-supplier-id="${x.supplier_id}">Edit</button> <button class="delete-btn" type="button" data-delete-product-supplier="${x.product_id}" data-supplier-id="${x.supplier_id}">Delete</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="5">No product suppliers linked yet.</td></tr>';
  }

  function openProductSupplierDialog(mapping = null) {
    if (!mapping && (!products.length || !suppliers.length)) {
      pageError("Add at least one product and one supplier before linking them.");
      return;
    }
    const form = $("product-supplier-form");
    form.reset();
    form.elements.product_id.innerHTML = productOptions();
    form.elements.supplier_id.innerHTML = suppliers
      .map((s) => `<option value="${s.supplier_id}">${esc(s.supplier_name)}</option>`)
      .join("");
    if (mapping) {
      form.dataset.mode = "edit";
      form.dataset.productId = mapping.product_id;
      form.dataset.supplierId = mapping.supplier_id;
      form.elements.product_id.value = mapping.product_id;
      form.elements.supplier_id.value = mapping.supplier_id;
      form.elements.supplier_product_code.value = mapping.supplier_product_code;
      form.elements.supply_price.value = mapping.supply_price;
    } else {
      form.dataset.mode = "add";
    }
    setText("product-supplier-title", mapping ? "Edit Product Supplier" : "Link Product to Supplier");
    setText("product-supplier-form-error", "");
    $("product-supplier-dialog").showModal();
  }

  async function initSuppliers() {
    await loadProducts();
    on("add-supplier-btn", "click", () => {
      $("supplier-form").reset();
      setText("supplier-form-error", "");
      $("supplier-dialog").showModal();
    });
    on("close-supplier-dialog", "click", () => $("supplier-dialog").close());
    $("supplier-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("POST", "/api/suppliers", Object.fromEntries(new FormData(event.currentTarget)));
        $("supplier-dialog").close();
        await loadSuppliers();
        renderSuppliers();
      } catch (error) {
        setText("supplier-form-error", error.message);
      }
    });
    $("suppliers-table").addEventListener(
      "click",
      guard(async (event) => {
        const button = event.target.closest("button[data-delete-supplier]");
        if (!button) return;
        const supplier = suppliers.find((s) => s.supplier_id === Number(button.dataset.deleteSupplier));
        if (!supplier) return;
        const links = productSuppliers.filter((x) => x.supplier_id === supplier.supplier_id).length;
        if (
          !window.confirm(
            `Delete "${supplier.supplier_name}"${links ? ` and its ${links} product supplier link(s)` : ""}? This cannot be undone.`,
          )
        )
          return;
        await api("DELETE", `/api/suppliers/${supplier.supplier_id}`);
        await loadSuppliers();
        renderSuppliers();
      }),
    );

    on("add-product-supplier-btn", "click", () => openProductSupplierDialog());
    on("close-product-supplier-dialog", "click", () => $("product-supplier-dialog").close());
    $("product-supplier-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      try {
        if (form.dataset.mode === "edit")
          await api("PUT", `/api/product-suppliers/${form.dataset.productId}/${form.dataset.supplierId}`, data);
        else await api("POST", "/api/product-suppliers", data);
        $("product-supplier-dialog").close();
        await loadSuppliers();
        renderSuppliers();
      } catch (error) {
        setText("product-supplier-form-error", error.message);
      }
    });
    $("product-suppliers-table").addEventListener(
      "click",
      guard(async (event) => {
        const edit = event.target.closest("button[data-edit-product-supplier]");
        const del = event.target.closest("button[data-delete-product-supplier]");
        if (edit) {
          const mapping = productSuppliers.find(
            (x) =>
              x.product_id === Number(edit.dataset.editProductSupplier) &&
              x.supplier_id === Number(edit.dataset.supplierId),
          );
          if (mapping) openProductSupplierDialog(mapping);
        }
        if (del) {
          if (!window.confirm("Delete this supplier link? This will not change product stock.")) return;
          await api("DELETE", `/api/product-suppliers/${del.dataset.deleteProductSupplier}/${del.dataset.supplierId}`);
          await loadSuppliers();
          renderSuppliers();
        }
      }),
    );
    renderSuppliers();
  }

  /* -------------------------------- users -------------------------------- */
  function renderUsers() {
    $("users-table").innerHTML = users
      .map(
        (u) =>
          `<tr><td>${u.user_id}</td><td>${esc(u.first_name + " " + u.last_name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td><span class="pill ${u.is_active ? "good" : "inactive"}">${u.is_active ? "Active" : "Inactive"}</span></td><td><button class="primary-btn update-btn" type="button" data-edit-user="${u.user_id}">Edit</button> <button class="delete-btn" type="button" data-delete-user="${u.user_id}">Delete</button></td></tr>`,
      )
      .join("");
  }

  function openUserDialog(user = null) {
    const form = $("user-form");
    form.reset();
    form.dataset.mode = user ? "edit" : "add";
    form.dataset.userId = user ? user.user_id : "";
    setText("user-form-error", "");
    setText("user-dialog-title", user ? "Edit user" : "Add user");
    setText("user-password-hint", user ? "(leave blank to keep current)" : "(required, min. 8 characters)");
    form.elements.user_id.value = user ? user.user_id : "";
    form.elements.first_name.value = user ? user.first_name : "";
    form.elements.last_name.value = user ? user.last_name : "";
    form.elements.username.value = user ? user.username : "";
    form.elements.role.value = user ? user.role : "Staff";
    form.elements.is_active.value = user ? String(user.is_active) : "1";
    form.elements.password.required = !user;
    form.elements.confirm_password.required = !user;
    $("user-dialog").showModal();
  }

  function initUsers() {
    on("add-user-btn", "click", () => openUserDialog());
    on("close-user-dialog", "click", () => $("user-dialog").close());
    $("users-table").addEventListener(
      "click",
      guard(async (event) => {
        const edit = event.target.closest("[data-edit-user]");
        const del = event.target.closest("[data-delete-user]");
        if (edit) {
          const user = users.find((u) => u.user_id === Number(edit.dataset.editUser));
          if (user) openUserDialog(user);
        }
        if (del) {
          const user = users.find((u) => u.user_id === Number(del.dataset.deleteUser));
          if (!user) return;
          if (!window.confirm(`Delete ${user.first_name} ${user.last_name}'s account?`)) return;
          await api("DELETE", `/api/users/${user.user_id}`);
          await loadUsers();
          renderUsers();
        }
      }, (message) =>
        pageError(
          /cannot be deleted/.test(message)
            ? "This user has recorded sales or stock movements and cannot be deleted. Set the account to Inactive instead."
            : message,
        )),
    );
    $("user-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      try {
        if (form.dataset.mode === "edit") await api("PUT", `/api/users/${form.dataset.userId}`, data);
        else await api("POST", "/api/users", data);
        $("user-dialog").close();
        await loadUsers();
        renderUsers();
      } catch (error) {
        setText("user-form-error", error.message);
      }
    });
    renderUsers();
  }

  /* -------------------------------- boot -------------------------------- */
  async function boot() {
    if (page === "dashboard") {
      on(
        "reset-sales-btn",
        "click",
        guard(async () => {
          if (
            !window.confirm(
              "Reset the total sales? Sales history and inventory will remain unchanged. Future sales will count toward the new total.",
            )
          )
            return;
          await api("POST", "/api/dashboard/reset-sales");
          await renderDashboard();
        }),
      );
      await renderDashboard();
    } else if (page === "products") {
      await Promise.all([loadCategories(), loadProducts()]);
      initProducts();
    } else if (page === "movements") {
      await loadMovements();
      initMovements();
    } else if (page === "sales") {
      await Promise.all([loadSaleItems(), isStaff ? loadProducts() : Promise.resolve()]);
      initSales();
    } else if (page === "suppliers") {
      await loadSuppliers();
      await initSuppliers();
    } else if (page === "users") {
      await loadUsers();
      initUsers();
    }
  }

  boot().catch((error) => pageError(error.message));
})();
