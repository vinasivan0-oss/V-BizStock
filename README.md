# VBizStock – Sales & Inventory


## Run it with Laragon
1. Open Laragon → **Start All**.
2. Open a terminal in VS Code and run:
   ```
   npm install
   npm start
   ```
3. Open **http://localhost:3000**

On first start Since there are no users yet, the login page shows **Create admin account** – fill it in once.


## First steps in the app
1. **Products → Categories**: add your categories.
2. **Products → Add Product**: add products (initial stock creates a STOCK_IN movement).
3. **Users → Add User**: create a **Staff** account. Only Staff can ring up sales (Admins view only).
4. Sign in as Staff → **Sales** → add to cart → *Complete Sale*.
   A sale saves `sale` + `sale_item`, reduces `product.stock_quantity`, and logs a STOCK_OUT in `inventory_movement` (all in one transaction).
