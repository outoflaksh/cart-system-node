const sqlite3 = require("sqlite3").verbose();
const { faker } = require("@faker-js/faker");

const db = new sqlite3.Database("./database.db");

function initializeDatabase() {
    // Create the users table if it doesn't exist
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

    // Create the products table if it doesn't exist
    db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL
    )
  `);

    // Create the carts table if it doesn't exist
    db.run(`
    CREATE TABLE IF NOT EXISTS carts (
      owner_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_quantity INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

    console.log("Database initialized successfully.");
}

function addSampleProducts() {
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (err) {
            console.error("Error checking products table:", err);
        } else if (row.count === 0) {
            const sampleProducts = generateSampleProducts(10);
            const insertQuery =
                "INSERT INTO products (name, price) VALUES (?, ?)";
            sampleProducts.forEach((product) => {
                db.run(
                    insertQuery,
                    [product.name, product.price],
                    (insertErr) => {
                        if (insertErr) {
                            console.error(
                                "Error inserting product:",
                                insertErr
                            );
                        }
                    }
                );
            });
        }
    });

    console.log("Mock product data added successfully.");
}

// Function to generate sample products
function generateSampleProducts(numProducts) {
    const products = [];
    for (let i = 1; i <= numProducts; i++) {
        const productName = faker.commerce.productName();
        const productPrice = parseFloat(faker.commerce.price());
        products.push({ name: productName, price: productPrice });
    }
    return products;
}

module.exports = { initializeDatabase, addSampleProducts };
