// --- CONFIGURATION ---
const CART_API_URL = "https://7fqnwxqun1.execute-api.eu-north-1.amazonaws.com/cart"; // Your Cart API
const ORDER_API_URL = "https://qidmv28lt5.execute-api.eu-north-1.amazonaws.com/default/OrderService"; // ⚠️ YOUR ORDER API
const PRODUCT_API_URL = "https://pvz4zn2pff.execute-api.eu-north-1.amazonaws.com/default/ProductService"; // ⚠️ PASTE YOUR PRODUCT URL HERE

// Cognito Settings (EU-NORTH-1)
const COGNITO_DOMAIN = "https://eu-north-15qqenyeuq.auth.eu-north-1.amazoncognito.com";
const CLIENT_ID = "7ruffih541m75ibvhbg5gamtle"; 
const REDIRECT_URI = window.location.origin + "/index.html"; // Works for both Localhost and Amplify

let userToken = null;

// --- INIT ---
window.onload = async () => {
    checkLogin();
    loadProducts();
};

// --- AUTH ---
function handleAuth() {
    if (userToken) {
        window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${REDIRECT_URI}`;
    } else {
        window.location.href = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=${REDIRECT_URI}`;
    }
}

function checkLogin() {
    const hash = window.location.hash;
    if (hash && hash.includes("id_token")) {
        const params = new URLSearchParams(hash.substring(1));
        userToken = params.get("id_token");
        window.history.replaceState({}, document.title, ".");
        document.getElementById("auth-btn").innerText = "Sign Out";
        loadCart();
    }
}

// --- PRODUCTS ---
async function loadProducts() {
    try {
        const res = await fetch(PRODUCT_API_URL);
        const data = await res.json();
        const products = data.products ? data.products : data; // Handle different API formats

        const grid = document.getElementById("product-grid");
        grid.innerHTML = products.map(p => `
            <div class="card">
                <img src="${p.imageUrl || 'https://via.placeholder.com/250'}" alt="${p.name}">
                <h3>${p.name || 'Cloud T-Shirt'}</h3>
                <p>${p.description || 'Premium Cloud Gear'}</p>
                <div class="price">$${p.price}</div>
                <div class="btn-group">
                    <button class="add-btn" onclick="addToCart('${p.productId}', '${p.name}', ${p.price})">
                        Add to Cart <i class="fas fa-cart-plus"></i>
                    </button>
                    <button class="buy-btn" onclick="buyNow('${p.productId}')" style="background:#007185; margin-top:5px;">
                        Buy Now <i class="fas fa-bolt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Error loading products:", e); }
}

// --- CART FUNCTIONS ---
async function addToCart(id, name, price) {
    if (!userToken) { alert("Please Sign In first!"); return; }
    try {
        await fetch(CART_API_URL, {
            method: "POST",
            body: JSON.stringify({ productId: id, name: name, price: price })
        });
        alert("Added to Cart!");
        loadCart();
    } catch (e) { console.error(e); }
}

async function loadCart() {
    if (!userToken) return;
    const res = await fetch(CART_API_URL);
    const items = await res.json();
    document.getElementById("cart-count").innerText = items.length;
    
    let total = 0;
    document.getElementById("cart-items").innerHTML = items.map(i => {
        total += parseFloat(i.price);
        return `<div class="cart-item"><span>${i.name}</span><span>$${i.price}</span></div>`;
    }).join('');
    document.getElementById("cart-total").innerText = total.toFixed(2);
}

// --- ORDER FUNCTIONS (Restored!) ---
async function buyNow(productId) {
    if (!userToken) { alert("Please Sign In first!"); return; }
    
    const confirmBuy = confirm("Buy this item instantly?");
    if (!confirmBuy) return;

    try {
        const res = await fetch(ORDER_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                productId: productId,
                quantity: 1,
                userId: "user-from-token" // In Phase 3 we will fix this to be real
            })
        });

        if (res.ok) {
            alert("✅ Order Placed Successfully!");
        } else {
            alert("❌ Order Failed.");
        }
    } catch (e) { console.error("Order Error:", e); }
}

// --- NAVIGATION ---
function showCart() { document.getElementById("product-page").classList.add("hidden"); document.getElementById("cart-page").classList.remove("hidden"); }
function showHome() { document.getElementById("product-page").classList.remove("hidden"); document.getElementById("cart-page").classList.add("hidden"); }