CREATE DATABASE IF NOT EXISTS `VBizStock_DB`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE `VBizStock_DB`;

CREATE TABLE IF NOT EXISTS `role` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `supplier` (
  `supplier_id` int NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(50) NOT NULL,
  `contact_number` varchar(30) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `address` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  KEY `fk_user_role` (`role_id`),
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`)
    REFERENCES `role` (`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `product_name` varchar(50) NOT NULL,
  `sku` varchar(30) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL,
  `reorder_level` int NOT NULL DEFAULT '10',
  `stock_quantity` int NOT NULL DEFAULT '0',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_product_category` (`category_id`),
  KEY `idx_product_stock` (`stock_quantity`),
  KEY `idx_product_status` (`status`),
  CONSTRAINT `fk_product_category` FOREIGN KEY (`category_id`)
    REFERENCES `category` (`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_product_cost_price` CHECK (`cost_price` >= 0),
  CONSTRAINT `chk_product_reorder_level` CHECK (`reorder_level` >= 0),
  CONSTRAINT `chk_product_stock` CHECK (`stock_quantity` >= 0),
  CONSTRAINT `chk_product_unit_price` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_supplier` (
  `product_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `supplier_product_code` varchar(30) DEFAULT NULL,
  `supply_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`product_id`,`supplier_id`),
  KEY `fk_ps_supplier` (`supplier_id`),
  CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ps_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `supplier` (`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_supply_price` CHECK (`supply_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sale` (
  `sale_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sale_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`sale_id`),
  KEY `idx_sale_date` (`sale_date`),
  KEY `idx_sale_user` (`user_id`),
  CONSTRAINT `fk_sale_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_sale_discount` CHECK (`discount` >= 0),
  CONSTRAINT `chk_sale_total` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sale_item` (
  `sale_id` bigint NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(12,2) NOT NULL,
  PRIMARY KEY (`sale_id`,`product_id`),
  KEY `idx_sale_item_product` (`product_id`),
  CONSTRAINT `fk_sale_item_product` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_item_sale` FOREIGN KEY (`sale_id`)
    REFERENCES `sale` (`sale_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_sale_item_discount` CHECK (`discount` >= 0),
  CONSTRAINT `chk_sale_item_price` CHECK (`unit_price` >= 0),
  CONSTRAINT `chk_sale_item_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `chk_sale_item_subtotal` CHECK (`subtotal` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inventory_movement` (
  `movement_id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `movement_type` enum('STOCK_IN','STOCK_OUT','ADJUSTMENT','RETURN') NOT NULL,
  `quantity` int NOT NULL,
  `movement_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_number` varchar(100) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`movement_id`),
  KEY `fk_movement_user` (`user_id`),
  KEY `idx_inventory_product` (`product_id`),
  KEY `idx_inventory_date` (`movement_date`),
  KEY `idx_inventory_type` (`movement_type`),
  KEY `idx_inventory_product_date` (`product_id`,`movement_date`),
  CONSTRAINT `fk_movement_product` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_movement_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_movement_quantity` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
