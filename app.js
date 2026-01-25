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
    const hash = window.location.hash;
    if (hash && hash.includes("id_token")) {
        const params = new URLSearchParams(hash.substring(1));
        userToken = params.get("id_token");
        localStorage.setItem("userToken", userToken);
        window.history.replaceState({}, document.title, "."); 
    } else {
        userToken = localStorage.getItem("userToken");
    }

    if (!userToken) {
        window.location.href = LOGIN_PAGE;
        return;
    }

    loadProducts();
    loadCart(); 
};

// --- HELPER: Get Real User ID ---
function getUserId() {
    if (!userToken) return null;
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        return payload.sub; // Unique User ID
    } catch (e) { return "guest"; }
}

// --- LOGOUT ---
function handleLogout() {
    localStorage.removeItem("userToken");
    window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${LOGIN_PAGE}`;
}

// --- PRODUCTS (I kept your working version!) ---
async function loadProducts() {
   try {
        const res = await fetch(PRODUCT_API_URL);
        const data = await res.json();
        const products = data.products ? data.products : data; 

        document.getElementById("product-grid").innerHTML = products.map(p => {
            // Logic to handle stock
            const isOutOfStock = p.stock === 0;
            const stockText = isOutOfStock ? '<span style="color:red; font-weight:bold;">Out of Stock</span>' : `In Stock: ${p.stock}`;
            const btnState = isOutOfStock ? 'disabled style="background-color:grey; cursor:not-allowed;"' : '';

            return `
            <div class="card">
                <img src="${p.imageUrl}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
                <h3>${p.name}</h3>
                <div class="price">$${p.price}</div>
                <div style="margin-bottom:10px; font-size:0.9em;">${stockText}</div>
                
                <div class="btn-group">
                    <button class="add-btn" onclick="addToCart('${p.productId}', '${p.name}', ${p.price}')" ${btnState}>
                        ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                    </button>
                    <button class="buy-btn" onclick="buyNow('${p.productId}', '${p.name}', ${p.price}')" ${btnState}>
                        ${isOutOfStock ? 'Sold Out' : 'Buy Now ⚡'}
                    </button>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) { console.error("Error loading products:", e); }
}

// --- CART (UPDATED FOR PRIVACY) ---

// 1. ADD TO CART (Sends userId)
async function addToCart(id, name, price) {
    if (!userToken) return alert("Please login first");
    const userId = getUserId(); // <--- NEW

    try {
        console.log("Sending to Cart:", { userId, productId: id });

        const res = await fetch(CART_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                userId: userId,    // <--- Sending Real ID
                productId: id, 
                name: name, 
                price: price 
            })
        });

        if (!res.ok) throw new Error("Server Error");

        alert("✅ Added to Cart!");
        loadCart(); 

    } catch (e) { 
        console.error("Add Cart Failed:", e);
        alert("❌ Failed to add: " + e.message);
    }
}

// 2. LOAD CART (Sends userId in URL)
async function loadCart() {
    if (!userToken) return;
    const userId = getUserId(); // <--- NEW

    try {
        // We add ?userId=... to the URL
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

        document.getElementById("cart-count").innerText = totalCount;
        document.getElementById("cart-items").innerHTML = items.length ? htmlList : "<p>Cart is empty</p>";
        document.getElementById("cart-total").innerText = totalPrice.toFixed(2);

    } catch (err) { console.error("Load Cart Error:", err); }
}

// 3. REMOVE (Sends userId)
async function removeFromCart(productId) {
    const userId = getUserId();
    // ⚠️ Updated to send both ID and ProductID
    await fetch(`${CART_API_URL}?userId=${userId}&productId=${productId}`, { method: "DELETE" });
    loadCart(); 
}

// --- ORDER (Your working version) ---
async function buyNow(productId, productName, price) {
    if (!userToken) return alert("Please Sign In first!");

    const payload = JSON.parse(atob(userToken.split('.')[1]));
    const userName = payload['cognito:username'] || "Valued Customer";
    const userEmail = payload['email'];

    const address = prompt("📦 Please enter your Shipping Address:", "APIIT City Campus, Colombo");
    
    if (!address) return; 
    if (!confirm(`Confirm purchase of ${productName} for $${price}?`)) return;

    try {
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