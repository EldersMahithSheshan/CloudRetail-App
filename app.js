// --- CONFIGURATION ---
const CART_API_URL = "https://7fqnwxqun1.execute-api.eu-north-1.amazonaws.com/cart";
const ORDER_API_URL = "https://qidmv28lt5.execute-api.eu-north-1.amazonaws.com/default/OrderService";
const PRODUCT_API_URL = "https://pvz4zn2pff.execute-api.eu-north-1.amazonaws.com/default/ProductService"; 

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
        window.history.replaceState({}, document.title, "."); 
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
    loadCart(); 
};

// --- HELPER: Get Real User ID from Token ---
function getUserId() {
    if (!userToken) return null;
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        return payload.sub; // 'sub' is the unique User ID
    } catch (e) { return null; }
}

// --- LOGOUT ---
function handleLogout() {
    localStorage.removeItem("userToken");
    window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${LOGIN_PAGE}`;
}

// --- PRODUCTS (UPDATED) ---
async function loadProducts() {
    if (!userToken) return;
    // Note: Products are public, so we don't strictly need userId to view them
    
    try {
        // ⚠️ FIXED: Now calling PRODUCT_API_URL instead of CART_API_URL
        const res = await fetch(PRODUCT_API_URL);
        const products = await res.json();
        
        const container = document.getElementById("product-list");
        container.innerHTML = products.map(p => `
            <div class="product-card">
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="price">$${p.price}</div>
                <button class="add-btn" onclick="addToCart('${p.productId}', '${p.name}', ${p.price})">Add to Cart</button>
                <button class="buy-btn" onclick="buyNow('${p.productId}', '${p.name}', ${p.price})">Buy Now ⚡</button>
            </div>
        `).join('');

    } catch (err) { 
        console.error("Load Products Failed:", err);
        document.getElementById("product-list").innerHTML = "<p>Failed to load products.</p>";
    }
}

// --- CART FUNCTIONS (UPDATED) ---

// 1. LOAD CART (Now sends ?userId=...)
async function loadCart() {
    if (!userToken) return;
    const userId = getUserId(); // <--- Get Real ID

    try {
        // ⚠️ FIXED: Sending userId in URL so backend knows whose cart to load
        const res = await fetch(`${CART_API_URL}?userId=${userId}`, { 
            method: "GET", 
            cache: "no-store" 
        });
        const items = await res.json();
        
        let totalCount = 0;
        let totalPrice = 0;

        const htmlList = items.map(item => {
            const qty = item.quantity || 1; 
            const price = parseFloat(item.price);
            
            totalCount += qty;
            totalPrice += (price * qty);

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

        // Update UI
        document.getElementById("cart-count").innerText = totalCount;
        document.getElementById("cart-items").innerHTML = items.length ? htmlList : "<p>Cart is empty</p>";
        document.getElementById("cart-total").innerText = totalPrice.toFixed(2);

    } catch (err) { console.error("Load Cart Error:", err); }
}

// 2. ADD TO CART (Sends userId in Body)
async function addToCart(id, name, price) {
    if (!userToken) return alert("Please login first");
    const userId = getUserId(); 

    try {
        await fetch(CART_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                userId: userId, // <--- SENDING REAL ID
                productId: id, 
                name: name, 
                price: price 
            })
        });
        alert("✅ Added to Cart!");
        loadCart(); 
    } catch (e) { console.error("Add Cart Error:", e); }
}

// 3. REMOVE FROM CART (Sends userId in URL)
async function removeFromCart(productId) {
    const userId = getUserId();
    // ⚠️ FIXED: Sending userId AND productId
    await fetch(`${CART_API_URL}?userId=${userId}&productId=${productId}`, { method: "DELETE" });
    loadCart();
}

// --- ORDER ---
async function buyNow(productId, productName, price) {
    if (!userToken) return alert("Please Sign In first!");

    const payload = JSON.parse(atob(userToken.split('.')[1]));
    const userName = payload['cognito:username'] || "Valued Customer";
    const userEmail = payload['email'];

    const address = prompt("📦 Please enter your Shipping Address:", "APIIT City Campus, Colombo");
    
    if (!address) return; 
    if (!confirm(`Confirm purchase of ${productName} for $${price}?`)) return;

    try {
        console.log("Sending Order...", { productId, address, userEmail });

        const res = await fetch(ORDER_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                productId: productId,
                name: productName,
                price: price,
                userId: payload.sub, 
                userName: userName,
                userEmail: userEmail,
                address: address 
            })
        });

        if (res.ok) {
            const data = await res.json();
            alert(`✅ Order Placed! \n\nOrder ID: ${data.orderId}\nCheck your email (${userEmail}) for the receipt.`);
        } else {
            const err = await res.text();
            alert("❌ Order Failed: " + err);
        }
    } catch (e) { 
        console.error("Order Error:", e);
        alert("Network Error: " + e.message);
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