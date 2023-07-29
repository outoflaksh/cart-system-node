const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const { initializeDatabase, addSampleProducts } = require("./database");

// Call the initializeDatabase function to set up tables and populate sample data
initializeDatabase();

// Populate the products table with sample mock data
addSampleProducts();

const db = new sqlite3.Database("./database.db");

// Secret key for JWT (You should use a more secure and unique key for production)
const secretKey = "secret123";

// Function to generate JWT token
function generateToken(user) {
    return jwt.sign(user, secretKey, { expiresIn: "1h" });
}

// Signup route
app.post("/signup", (req, res) => {
    const { username, password } = req.body;

    // Hash the password before storing it in the database
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert the user into the database
    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
            if (err) {
                return res.status(500).json({ error: "Failed to create user" });
            }
            res.json({ message: "User created successfully" });
        }
    );
});

// Login route
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Fetch the user from the database by username
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Failed to query database" });
        }

        // Check if the user exists
        if (!row) {
            return res.status(401).json({ error: "Authentication failed" });
        }

        // Compare the provided password with the hashed password in the database
        bcrypt.compare(password, row.password, (bcryptErr, result) => {
            if (bcryptErr || !result) {
                return res.status(401).json({ error: "Authentication failed" });
            }

            // If the password is correct, generate a JWT token and return it
            const token = generateToken({ id: row.id, username: row.username });
            res.json({ token });
        });
    });
});

// Middleware to validate JWT token
function validateToken(req, res, next) {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
        return res.status(401).json({ error: "Access denied. Token missing." });
    }

    // Check if the token starts with "Bearer "
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: 'Invalid token format. It should start with "Bearer "',
        });
    }

    const token = authHeader.substring(7); // Remove "Bearer " from the token

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token." });
        }

        req.user = user;
        next();
    });
}

// Sample protected route
app.get("/protected", validateToken, (req, res) => {
    // Access the authenticated user's information through req.user
    res.json({ message: "This is a protected route.", user: req.user });
});

// View all product data
app.get("/products", validateToken, (req, res) => {
    db.all("SELECT * FROM products;", (err, row) => {
        if (err) {
            return res
                .status(500)
                .json("Something went wrong while retrieving data.");
        }

        return res.json(row);
    });
});

// Retrieve current cart info
app.get("/cart", validateToken, async (req, res) => {
    try {
        const userID = req.user.id;

        const rows = await new Promise((resolve, reject) => {
            db.all(
                "SELECT * FROM carts WHERE owner_id=?",
                [userID],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        const cartDetails = await Promise.all(
            rows.map(async (r) => {
                const productRow = await new Promise((resolve, reject) => {
                    db.get(
                        "SELECT * FROM products WHERE id = ?",
                        [r.product_id],
                        (err, row) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(row);
                            }
                        }
                    );
                });

                const quantity = r.product_quantity;
                const unit_price = productRow.price;
                const type = "product";
                let tax = 200;

                if (type === "product") {
                    if (unit_price > 1000 && unit_price <= 5000) {
                        tax = unit_price * 0.12;
                    } else if (unit_price > 5000) {
                        tax = unit_price * 0.18;
                    }
                } else if (type === "service") {
                    if (unit_price > 1000 && unit_price <= 8000) {
                        tax = unit_price * 0.1;
                    } else if (unit_price > 8000) {
                        tax = unit_price * 0.15;
                    }
                }
                const total_price = quantity * unit_price + tax;

                return {
                    product_id: productRow.id,
                    product_name: productRow.name,
                    unit_price: unit_price,
                    quantity: quantity,
                    tax: tax,
                    total_price: total_price,
                };
            })
        );

        const total_amount = cartDetails.reduce(
            (acc, item) => acc + item.total_price,
            0
        );

        return res.json({ cartDetails, total_amount });
    } catch (error) {
        return res.status(500).json({ detail: "Error occurred" });
    }
});

app.post("/cart/add", validateToken, (req, res) => {
    // The product ID and the quantity will be added in the cart
    const { productID, quantity } = req.body;

    const userID = req.user.id;
    db.run(
        "INSERT INTO carts VALUES (?, ?, ?);",
        [userID, productID, quantity],
        (err) => {
            if (err) {
                console.log("Error:", err);
                return res
                    .status(500)
                    .json({ detail: "Error occurred while inserting to cart" });
            }

            return res.json({ detail: "Added to cart successfully" });
        }
    );
});

app.delete("/cart", validateToken, (req, res) => {
    const userID = req.user.id;

    db.run("DELETE FROM carts WHERE owner_id=?", [userID], (err) => {
        if (err) {
            console.log("Error:", err);
            return res
                .status(500)
                .json({ detail: "Error occurred while clearing the cart" });
        }

        return res.json({ detail: "Cart cleared successfully" });
    });
});

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
