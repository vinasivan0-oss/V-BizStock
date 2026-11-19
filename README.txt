# Small Business Sales & Inventory — Frontend Demo

## Files
- `index.html` — entry point that opens the dashboard
- `dashboard.html` — dashboard overview
- `products.html` — product inventory and add-product form
- `inventory-movements.html` — stock activity history
- `sales.html` — sales and sale-item records
- `suppliers.html` — supplier directory and product supply information
- `users.html` — registered users and roles
- `style.css` — responsive dashboard styling
- `script.js` — sample data and browser-side interactions

## Run it
1. Extract the ZIP file.
2. Open `index.html` or `dashboard.html` in a browser, or use VS Code Live Server.
3. Use the sidebar to move between the separate pages for Dashboard, Products, Inventory Movements, Sales, Suppliers, and Users.
4. In Products, use **Add Product** to add a row or **Delete** on a product to remove it from the in-memory demo data. Search and category filtering are also available.

## Important database note
A browser page made with HTML/CSS/JavaScript cannot safely connect directly to a MySQL database. This demo uses JavaScript arrays populated from the sample rows in your SQL dump. Changes are temporary and disappear when the page is refreshed.

To make it a live system, add a backend API (for example PHP + MySQL on Laragon, or Node.js + Express + MySQL). The frontend should call that API using `fetch()`. Keep database credentials and password hashes on the server, never in browser JavaScript.

## SQL tables represented
`category`, `product`, `inventory_movement`, `sale`, `sale_item`, `customer`, `supplier`, `product_supplier`, `users`, and `role`.

The pages display the supplied sample records. Adding and deleting products are frontend-only demonstrations; they do not execute database INSERT or DELETE statements.
