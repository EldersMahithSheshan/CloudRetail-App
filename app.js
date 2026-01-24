// --- CONFIGURATION ---
const CART_API_URL = "https://7fqnwxqun1.execute-api.eu-north-1.amazonaws.com/cart";
const ORDER_API_URL = "https://qidmv28lt5.execute-api.eu-north-1.amazonaws.com/default/OrderService";
const PRODUCT_API_URL = "https://pvz4zn2pff.execute-api.eu-north-1.amazonaws.com/default/ProductService"; // ⚠️ PASTE YOUR PRODUCT URL HERE

const COGNITO_DOMAIN = "https://eu-north-15qqenyeuq.auth.eu-north-1.amazoncognito.com";
const CLIENT_ID = "7ruffih541m75ibvhbg5gamtle"; 
const LOGIN_PAGE = window.location.origin + "/index.html"; 

let userToken = null;

// --- INITIALIZE ---
window.onload = async () => {
    // 1. Check if we just came back from Cognito with a token
    const hash = window.location.hash;
    if (hash && hash.includes("id_token")) {
        const params = new URLSearchParams(hash.substring(1));
        userToken = params.get("id_token");
        localStorage.setItem("userToken", userToken);
        window.history.replaceState({}, document.title, "."); // Remove token from URL bar
    } else {
        // 2. Or check if we already have it saved
        userToken = localStorage.getItem("userToken");
    }

    // 3. Security Guard: If no token, kick them back to index.html
    if (!userToken) {
        window.location.href = LOGIN_PAGE;
        return;
    }

    // 4. Load Data
    loadProducts();
    loadCart(); // <--- This runs immediately to update the number!
};

// --- LOGOUT ---
function handleLogout() {
    localStorage.removeItem("userToken");
    // Redirect to Cognito Logout, then back to Index
    window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${LOGIN_PAGE}`;
}

// --- PRODUCTS ---
async function loadProducts() {
    try {
        const res = await fetch(PRODUCT_API_URL);
        const data = await res.json();
        const products = data.products ? data.products : data; 

        document.getElementById("product-grid").innerHTML = products.map(p => `
            <div class="card">
                <img src="${p.imageUrl || 'https://via.placeholder.com/250'}" alt="${p.name}">
                <h3>${p.name || 'Cloud T-Shirt'}</h3>
                <p>${p.description || ''}</p>
                <div class="price">$${p.price}</div>
                <div class="btn-group">
                    <button class="add-btn" onclick="addToCart('${p.productId}', '${p.name}', ${p.price})">Add to Cart</button>
                    <button class="buy-btn" onclick="buyNow('${p.productId}')">Buy Now</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Error loading products:", e); }
}

// --- CART (FIXED) ---
async function addToCart(id, name, price) {
    if (!userToken) return alert("Please login first");

    try {
        console.log("Sending to Cart:", { productId: id, name: name, price: price });

        const res = await fetch(CART_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: id, name: name, price: price })
        });

        // 1. Check if the Server said "OK"
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server Error (${res.status}): ${errorText}`);
        }

        // 2. Success!
        const data = await res.json();
        console.log("Success:", data);
        alert("✅ Added to Cart!");
        
        // 3. Refresh Counter
        loadCart(); 

    } catch (e) { 
        console.error("Add Cart Failed:", e);
        alert("❌ Failed to add: " + e.message);
    }
}

async function loadCart() {
   if (!userToken) return;

    try {
        const res = await fetch(CART_API_URL, { method: "GET", cache: "no-store" });
        const items = await res.json();
        
        // 1. CALCULATE TOTAL QUANTITY (Sum up all the 'quantity' numbers)
        // If an item has quantity 3, this adds 3.
        let totalCount = 0;
        let totalPrice = 0;

        const htmlList = items.map(item => {
            const qty = item.quantity || 1; // Default to 1 if missing
            const price = parseFloat(item.price);
            
            totalCount += qty;
            totalPrice += (price * qty);

            // Show "Product Name (x3)"
            return `
            <div class="cart-item">
                <div style="flex-grow:1">
                    <strong>${item.name}</strong> 
                    <span style="color:#666; font-size:0.9em"> (x${qty})</span>
                </div>
                <span>$${(price * qty).toFixed(2)}</span>
                <button onclick="removeFromCart('${item.productId}')" style="color:red;border:none;background:none;cursor:pointer;margin-left:10px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        }).join('');

        // 2. Update the Navbar Counter
        document.getElementById("cart-count").innerText = totalCount;
        
        // 3. Update the List and Total Price
        document.getElementById("cart-items").innerHTML = items.length ? htmlList : "<p>Cart is empty</p>";
        document.getElementById("cart-total").innerText = totalPrice.toFixed(2);

    } catch (err) { console.error("Load Cart Error:", err); }
}

async function removeFromCart(id) {
    await fetch(`${CART_API_URL}?productId=${id}`, { method: "DELETE" });
    loadCart(); // Refresh list after delete
}

// --- ORDER ---
async function buyNow(productId) {
    if(confirm("Buy this item instantly?")) {
        const res = await fetch(ORDER_API_URL, {
            method: "POST",
            body: JSON.stringify({ productId: productId, quantity: 1, userId: "user-from-token" })
        });
        alert(res.ok ? "Order Success!" : "Order Failed");
    }
}

// --- NAVIGATION ---
function showCart() { 
    document.getElementById("product-page").classList.add("hidden"); 
    document.getElementById("cart-page").classList.remove("hidden"); 
}
function showHome() { 
    document.getElementById("product-page").classList.remove("hidden"); 
    document.getElementById("cart-page").classList.add("hidden"); 
}