# VBizStock – Sales & Inventory


## Run it (PostgreSQL)
1. Install PostgreSQL and make sure the server is running.
   (Laragon users: enable PostgreSQL in Laragon, or install it separately.)
2. Open `.env` and set `DB_PASSWORD` to your PostgreSQL password. The defaults are
   `127.0.0.1:5432`, user `postgres`, database `vbizstock_db`.
   The user needs permission to create databases the first time.
3. Open a terminal in VS Code and run:
   ```
   npm install
   npm start
   ```
4. Open **http://localhost:3000**

The app creates the `vbizstock_db` database, all tables and the two roles automatically on start.
To create the tables by hand instead, run `db/VBizStock_DB.sql` with `psql`.

On first start Since there are no users yet, the login page shows **Create admin account** – fill it in once.


## First steps in the app
1. **Products → Categories**: add your categories.
2. **Products → Add Product**: add products (initial stock creates a STOCK_IN movement).
3. **Users → Add User**: create a **Staff** account. Only Staff can ring up sales (Admins view only).
4. Sign in as Staff → **Sales** → add to cart → *Complete Sale*.
   A sale saves `sale` + `sale_item`, reduces `product.stock_quantity`, and logs a STOCK_OUT in `inventory_movement` (all in one transaction).
