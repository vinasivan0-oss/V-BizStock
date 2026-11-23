# VBizStock – Sales & Inventory (Node.js + Express + MySQL)

The frontend (`public/`) now talks to a real MySQL database through a Node.js API (`server.js`).
There is **no sample data** – everything is entered by the users.

## Run it with Laragon
1. Open Laragon → **Start All** (this starts MySQL).
2. Open a terminal in this folder (Laragon → *Terminal*) and run:
   ```
   npm install
   npm start
   ```
3. Open **http://localhost:3000**

On first start the server creates the `VBizStock_DB` database and all tables from
`db/VBizStock_DB.sql`, and adds the two roles (`Admin`, `Staff`).
Since there are no users yet, the login page shows **Create admin account** – fill it in once.

Database settings live in `.env` (Laragon defaults: user `root`, empty password, port 3306).
If your MySQL has a password, set `DB_PASSWORD`. Change `JWT_SECRET` to your own random string.

## First steps in the app
1. **Products → Categories**: add your categories.
2. **Products → Add Product**: add products (initial stock creates a STOCK_IN movement).
3. **Users → Add User**: create a **Staff** account. Only Staff can ring up sales (Admins view only).
4. Sign in as Staff → **Sales** → add to cart → *Complete Sale*.
   A sale saves `sale` + `sale_item`, reduces `product.stock_quantity`, and logs a STOCK_OUT in `inventory_movement` (all in one transaction).

## Structure
- `server.js` – Express API + MySQL (mysql2), bcrypt passwords, JWT in an httpOnly cookie
- `db/VBizStock_DB.sql` – your schema (unchanged, no inserts)
- `public/` – HTML/CSS and browser JS (`auth.js` login/session, `script.js` pages)
