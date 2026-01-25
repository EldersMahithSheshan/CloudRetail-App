// ==========================================
// 🚀 CLOUD RETAIL - APP CONTROLLER (Final)
// ==========================================

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

// ==========================================
// 1. PRODUCTS (Safe Version + Stock Logic)
// ==========================================
async function loadProducts() {
    try {
        const res = await fetch(PRODUCT_API_URL);
        const data = await res.json();
        const products = data.products ? data.products : data; 

        window.allProducts = products;

        document.getElementById("product-grid").innerHTML = products.map(p => {
            const stockCount = (p.stock !== undefined) ? p.stock : 10;
            const isOutOfStock = stockCount === 0;
            const imageSrc = p.imageUrl ? p.imageUrl : 'https://via.placeholder.com/250';

            return `
            <div class="card">
                <img src="${imageSrc}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
                <h3>${p.name}</h3>
                <p>${p.description || ''}</p>
                <div class="price">$${p.price}</div>
                
                <div id="stock-${p.productId}" style="margin-bottom:10px; font-size:0.9em;">
                    ${isOutOfStock ? '<span style="color:red; font-weight:bold;">Out of Stock</span>' : `<span style="color:green;">In Stock: ${stockCount}</span>`}
                </div>
                
                <div class="btn-group">
                    <button id="btn-add-${p.productId}" class="add-btn" onclick="addToCartWrapper('${p.productId}')" ${isOutOfStock ? 'disabled style="background-color:grey;"' : ''}>
                        ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                    </button>
                    <button id="btn-buy-${p.productId}" class="buy-btn" onclick="buyNowWrapper('${p.productId}')" ${isOutOfStock ? 'disabled style="background-color:grey;"' : ''}>
                        ${isOutOfStock ? 'Sold Out' : 'Buy Now ⚡'}
                    </button>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) { console.error("Error loading products:", e); }
}

// --- WRAPPERS (These fix the syntax errors) ---
function addToCartWrapper(productId) {
    const product = window.allProducts.find(p => p.productId == productId);
    
    // ⚠️ NEW: Check if Cart Quantity >= Stock
    const cartItem = window.cartItems ? window.cartItems.find(c => c.productId == productId) : null;
    const currentQty = cartItem ? cartItem.quantity : 0;

    if (product && currentQty >= product.stock) {
        alert(`❌ Max Limit Reached! \nWe only have ${product.stock} in stock.`);
        return; // Stop here, don't add to cart
    }

    if (product) addToCart(product.productId, product.name, product.price);
}

function buyNowWrapper(productId) {
    const product = window.allProducts.find(p => p.productId == productId);
    if (product) buyNow(product.productId, product.name, product.price);
}


// ==========================================
// 2. CART FUNCTIONS
// ==========================================
async function addToCart(id, name, price) {
    if (!userToken) return alert("Please login first");
    const userId = getUserId(); 

    try {
        console.log("Sending to Cart:", { userId, productId: id });

        const res = await fetch(CART_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                userId: userId, 
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

async function loadCart() {
   if (!userToken) return;
    const userId = getUserId(); 

    try {
        const res = await fetch(`${CART_API_URL}?userId=${userId}`, { 
            method: "GET", 
            cache: "no-store" 
        });
        const items = await res.json();
        
        // ⚠️ NEW: Save items globally so we know what user has
        window.cartItems = items;

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

        // ⚠️ NEW: Trigger the UI update
        updateStockUI();

    } catch (err) { console.error("Load Cart Error:", err); }
}

async function removeFromCart(productId) {
    const userId = getUserId();
    await fetch(`${CART_API_URL}?userId=${userId}&productId=${productId}`, { method: "DELETE" });
    loadCart(); 
}
function updateStockUI() {
   if (!window.allProducts || !window.cartItems) return;

    window.allProducts.forEach(p => {
        const cartItem = window.cartItems.find(c => c.productId === p.productId);
        const qtyInCart = cartItem ? cartItem.quantity : 0;
        const available = p.stock - qtyInCart;

        // 1. Update Text
        const stockEl = document.getElementById(`stock-${p.productId}`);
        if (stockEl) {
            if (available <= 0) {
                 stockEl.innerHTML = '<span style="color:red; font-weight:bold;">Limit Reached</span>';
            } else {
                 stockEl.innerHTML = `<span style="color:green;">In Stock: ${available}</span> <span style="color:#888;font-size:0.8em;">(${qtyInCart} in cart)</span>`;
            }
        }

        // 2. Disable "Add to Cart" AND "Buy Now"
        const btnAdd = document.getElementById(`btn-add-${p.productId}`);
        const btnBuy = document.getElementById(`btn-buy-${p.productId}`); // <--- NEW

        if (available <= 0) {
            // Case: Limit Reached
            if (btnAdd) {
                btnAdd.disabled = true;
                btnAdd.style.backgroundColor = "grey";
                btnAdd.innerText = "Max Added";
            }
            if (btnBuy) {
                btnBuy.disabled = true;
                btnBuy.style.backgroundColor = "grey";
                btnBuy.innerText = "Max Added";
            }
        } else {
            // Case: Stock Available
            if (btnAdd) {
                btnAdd.disabled = false;
                btnAdd.style.backgroundColor = ""; 
                btnAdd.innerText = "Add to Cart";
            }
            if (btnBuy) {
                btnBuy.disabled = false;
                btnBuy.style.backgroundColor = ""; 
                btnBuy.innerText = "Buy Now ⚡";
            }
        }
    });
}

// ==========================================
// 3. ORDER & CHECKOUT ENGINE (Updated)
// ==========================================

// This function now returns TRUE if success, FALSE if failed
async function buyNow(productId, productName, price, addressOverride = null) {
    if (!userToken) {
        alert("Please Sign In first!");
        return false;
    }

    const payload = JSON.parse(atob(userToken.split('.')[1]));
    const userName = payload['cognito:username'] || "Valued Customer";
    const userEmail = payload['email'];

    // If we have an override (from Checkout loop), use it. Otherwise ask user.
    let address = addressOverride;
    if (!address) {
        address = prompt("📦 Please enter your Shipping Address:", "APIIT City Campus, Colombo");
    }
    
    if (!address) return false; 
    
    // Only ask for confirmation for single buys
    if (!addressOverride && !confirm(`Confirm purchase of ${productName} for $${price}?`)) return false;

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
            if (!addressOverride) {
                alert(`✅ Order Placed! \n\nOrder ID: ${data.orderId}\nCheck your email (${userEmail}) for the receipt.`);
            }
            return true; // SUCCESS
        } else {
            const err = await res.text();
            console.error("Order Failed:", err);
            return false;
        }
    } catch (e) { 
        console.error("Order Error:", e);
        return false;
    }
}

// --- CHECKOUT CART LOOP ---
async function checkoutCart() {
    if (!userToken) return;
    const userId = getUserId();

    // 1. Get Cart Items
    const res = await fetch(`${CART_API_URL}?userId=${userId}`, { method: "GET", cache: "no-store" });
    const items = await res.json();

    if (items.length === 0) return alert("Your cart is empty!");

    // 2. Ask for Address ONCE
    const address = prompt("📦 Enter Shipping Address for ALL items:", "APIIT City Campus, Colombo");
    if (!address) return;

    // 3. Loop and Buy
    let successCount = 0;
    
    // Update Button Text
    const btn = document.getElementById("checkout-btn");
    if(btn) btn.innerText = "Processing...";

    for (const item of items) {
        const qty = item.quantity || 1;
        // Buy item X times based on quantity
        for (let i = 0; i < qty; i++) {
             const success = await buyNow(item.productId, item.name, item.price, address);
             if (success) successCount++;
        }
    }

    if(btn) btn.innerText = "Proceed to Checkout";

    // 4. Finish
    if (successCount > 0) {
        alert(`✅ Checkout Complete! ${successCount} items ordered.\nCheck your email for receipts.`);
        // Clear Cart
        for (const item of items) {
            await fetch(`${CART_API_URL}?userId=${userId}&productId=${item.productId}`, { method: "DELETE" });
        }
        loadCart(); 
    } else {
        alert("❌ Checkout failed. Items might be out of stock.");
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