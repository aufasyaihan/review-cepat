-- Create the MySQL databases (run against your local MySQL server):
--   mysql -u root -p < scripts/db.sql
CREATE DATABASE IF NOT EXISTS review_cepat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS review_cepat_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON review_cepat.* TO 'root'@'localhost';
GRANT ALL PRIVILEGES ON review_cepat_test.* TO 'root'@'localhost';
FLUSH PRIVILEGES;