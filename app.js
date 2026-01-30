// ==========================================
// 🚀 CLOUD RETAIL - APP CONTROLLER (Final Synchronized)
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
    // 1. Auth Check
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

    // 2. ROUTING: Which page are we on?
    if (window.location.pathname.includes("product.html")) {
        // Detail Page: It handles its own data loading internally for perfect sync
        loadProductDetail(); 
    } else {
        // Home Page: Load Cart and Products
        loadCart(); 
        loadProducts(); 
    }

    // 3. Handle Cart Redirects
    if (window.location.hash === "#cart") {
        showCart(); 
        window.history.replaceState({}, document.title, "."); 
    }
};

// --- HELPER: Get Real User ID ---
function getUserId() {
    if (!userToken) return null;
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        return payload.sub; 
    } catch (e) { return "guest"; }
}

// --- LOGOUT ---
function handleLogout() {
    localStorage.removeItem("userToken");
    window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${LOGIN_PAGE}`;
}

// ==========================================
// 1. PRODUCTS (Home Page)
// ==========================================
async function loadProducts() {
    try {
        const res = await fetch(PRODUCT_API_URL, { cache: "no-store" });
        const data = await res.json();
        const products = data.products ? data.products : data; 

        window.allProducts = products;

        document.getElementById("product-grid").innerHTML = products.map(p => {
            const stockCount = (p.stock !== undefined) ? p.stock : 10;
            const isOutOfStock = stockCount === 0;
            const imageSrc = p.imageUrl ? p.imageUrl : 'https://via.placeholder.com/250';

            return `
            <div class="card">
                <a href="product.html?id=${p.productId}" style="text-decoration:none; color:inherit;">
                    <img src="${imageSrc}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/250?text=No+Image'" style="cursor:pointer">
                    <h3 style="cursor:pointer">${p.name}</h3>
                </a>
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

        // Try to update UI if cart is already loaded
        if (window.cartItems) updateStockUI();

    } catch (e) { console.error("Error loading products:", e); }
}

// ==========================================
// ⚠️ NEW: SYNCHRONIZED DETAIL PAGE
// ==========================================
async function loadProductDetail() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");

    if (!productId) {
        document.getElementById("loading").innerText = "Product Not Found";
        return;
    }

    try {
        // 1. Fetch BOTH Products and Cart
        const [productRes, cartRes] = await Promise.all([
            fetch(PRODUCT_API_URL, { cache: "no-store" }),
            fetch(`${CART_API_URL}?userId=${getUserId()}`, { cache: "no-store" })
        ]);

        const prodData = await productRes.json();
        const products = prodData.products ? prodData.products : prodData;
        window.allProducts = products;

        const cartData = await cartRes.json();
        window.cartItems = cartData;
        
        // Update Header Cart Count
        let totalCount = 0;
        cartData.forEach(item => totalCount += (item.quantity || 1));
        document.getElementById("cart-count").innerText = totalCount;

        // 2. Find Main Product
        const p = products.find(item => item.productId === productId);
        if (!p) {
            document.getElementById("loading").innerText = "Product Not Found";
            return;
        }

        document.getElementById("loading").style.display = "none";

        // Logic for Main Product
        const cartItem = window.cartItems.find(c => c.productId === p.productId);
        const qtyInCart = cartItem ? cartItem.quantity : 0;
        const stockCount = (p.stock !== undefined) ? p.stock : 10;
        const available = stockCount - qtyInCart;
        const isOutOfStock = available <= 0;
        const imageSrc = p.imageUrl ? p.imageUrl : 'https://via.placeholder.com/400';

        // 3. Render Main Detail View
        const html = `
            <div class="detail-image">
                <img src="${imageSrc}" alt="${p.name}">
            </div>
            <div class="detail-info">
                <h1>${p.name}</h1>
                <div class="detail-price">$${p.price}</div>
                <p class="product-description">${p.description}</p>

                <div id="stock-${p.productId}" style="margin-bottom:25px; font-size:1.1em; font-weight:500;">
                    ${available <= 0 
                        ? '<span style="color:red; font-weight:bold;">Limit Reached</span>' 
                        : `<span style="color:#008000;">In Stock: ${available}</span> <span style="color:#888;font-size:0.8em;">(${qtyInCart} in cart)</span>`
                    }
                </div>

                <div class="btn-group" style="justify-content: start;">
                    <button id="btn-add-${p.productId}" class="add-btn" style="padding:15px 40px;" onclick="addToCartWrapper('${p.productId}')" ${isOutOfStock ? 'disabled' : ''}>
                         ${isOutOfStock ? 'Max Added' : 'Add to Cart'}
                    </button>
                    <button id="btn-buy-${p.productId}" class="buy-btn" style="padding:15px 40px;" onclick="buyNowWrapper('${p.productId}')" ${isOutOfStock ? 'disabled' : ''}>
                         ${isOutOfStock ? 'Max Added' : 'Buy Now'}
                    </button>
                </div>
            </div>
        `;
        document.getElementById("product-detail-container").innerHTML = html;

        // 4. Render "Related Products" (Excluding current item)
        // We pick 4 random items that are NOT the current one
        const related = products.filter(item => item.productId !== p.productId).slice(0, 4);
        
        document.getElementById("related-products-grid").innerHTML = related.map(rp => {
            // Logic for Related Item Cards
            const rStock = (rp.stock !== undefined) ? rp.stock : 10;
            const rCartItem = window.cartItems.find(c => c.productId === rp.productId);
            const rQty = rCartItem ? rCartItem.quantity : 0;
            const rAvailable = rStock - rQty;
            const rOut = rAvailable <= 0;
            const rImg = rp.imageUrl ? rp.imageUrl : 'https://via.placeholder.com/250';

            return `
            <div class="card">
                <a href="product.html?id=${rp.productId}" style="text-decoration:none; color:inherit;">
                    <img src="${rImg}" alt="${rp.name}">
                    <h3>${rp.name}</h3>
                </a>
                <div class="price">$${rp.price}</div>
                <div id="stock-${rp.productId}" style="margin-bottom:10px; font-size:0.9em;">
                    ${rOut ? '<span style="color:red; font-weight:bold;">Out of Stock</span>' : `<span style="color:green;">In Stock: ${rAvailable}</span>`}
                </div>
                <div class="btn-group">
                    <button id="btn-add-${rp.productId}" class="add-btn" onclick="addToCartWrapper('${rp.productId}')" ${rOut ? 'disabled' : ''}>Add</button>
                    <button id="btn-buy-${rp.productId}" class="buy-btn" onclick="buyNowWrapper('${rp.productId}')" ${rOut ? 'disabled' : ''}>Buy</button>
                </div>
            </div>
            `;
        }).join('');


    } catch (e) {
        console.error(e);
        document.getElementById("loading").innerText = "Error loading details.";
    }
}

// --- WRAPPERS (Instant Feedback) ---
function addToCartWrapper(productId) {
    const product = window.allProducts.find(p => p.productId == productId);
    
    // Check Cart Limit
    const cartItem = window.cartItems ? window.cartItems.find(c => c.productId == productId) : null;
    const currentQty = cartItem ? cartItem.quantity : 0;

    if (product && currentQty >= product.stock) {
        alert(`❌ Max Limit Reached! \nWe only have ${product.stock} in stock.`);
        return;
    }

    // ✅ INSTANT UI UPDATE
    if (product) {
        const newAvailable = product.stock - (currentQty + 1);
        
        const stockEl = document.getElementById(`stock-${productId}`);
        if (stockEl) {
             stockEl.innerHTML = `<span style="color:green;">In Stock: ${newAvailable}</span> <span style="color:#888;font-size:0.8em;">(updating...)</span>`;
        }

        addToCart(product.productId, product.name, product.price);
    }
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
        const res = await fetch(CART_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, productId: id, name, price })
        });

        if (!res.ok) throw new Error("Server Error");

        console.log("Added to cart, refreshing UI...");
        await loadCart(); // Refresh global data
        updateStockUI();  // Clean up the "updating..." text

    } catch (e) { 
        console.error("Add Cart Failed:", e);
        alert("❌ Failed to add: " + e.message);
        loadProducts(); // Reset UI on failure
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
        
        window.cartItems = items;

        // If we are on the Home Page (Grid), update the cart list HTML
        const cartList = document.getElementById("cart-items");
        if (cartList) {
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
            cartList.innerHTML = items.length ? htmlList : "<p>Cart is empty</p>";
            document.getElementById("cart-total").innerText = totalPrice.toFixed(2);
        } else {
             // If on Detail page, just update the Header count
             let totalCount = 0;
             items.forEach(i => totalCount += (i.quantity || 1));
             const countEl = document.getElementById("cart-count");
             if(countEl) countEl.innerText = totalCount;
        }

        updateStockUI();

    } catch (err) { console.error("Load Cart Error:", err); }
}

async function removeFromCart(productId) {
    const userId = getUserId();
    await fetch(`${CART_API_URL}?userId=${userId}&productId=${productId}`, { method: "DELETE" });
    loadCart(); 
}

// --- SMART STOCK UPDATE ---
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

        // 2. Disable Buttons
        const btnAdd = document.getElementById(`btn-add-${p.productId}`);
        const btnBuy = document.getElementById(`btn-buy-${p.productId}`);

        if (available <= 0) {
            if (btnAdd) { btnAdd.disabled = true; btnAdd.style.backgroundColor = "grey"; btnAdd.innerText = "Max Added"; }
            if (btnBuy) { btnBuy.disabled = true; btnBuy.style.backgroundColor = "grey"; btnBuy.innerText = "Max Added"; }
        } else {
            if (btnAdd) { btnAdd.disabled = false; btnAdd.style.backgroundColor = ""; btnAdd.innerText = "Add to Cart"; }
            if (btnBuy) { btnBuy.disabled = false; btnBuy.style.backgroundColor = ""; btnBuy.innerText = "Buy Now ⚡"; }
        }
    });
}

// ==========================================
// 3. ORDER & CHECKOUT ENGINE
// ==========================================

async function buyNow(productId, productName, price, addressOverride = null) {
   if (!userToken) { alert("Please Sign In first!"); return false; }

    const payload = JSON.parse(atob(userToken.split('.')[1]));
    const userName = payload['cognito:username'] || "Valued Customer";
    const userEmail = payload['email'];

    let address = addressOverride;
    if (!address) { address = prompt("📦 Please enter your Shipping Address:", "APIIT City Campus, Colombo"); }
    if (!address) return false; 
    
    if (!addressOverride && !confirm(`Confirm purchase of ${productName} for $${price}?`)) return false;

    try {
        const res = await fetch(ORDER_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                productId: productId, name: productName, price: price,
                userId: payload.sub, userName: userName, userEmail: userEmail, address: address 
            })
        });

        if (res.ok) {
            const data = await res.json();
            
            // Only show alert and refresh if this is a SINGLE purchase
            if (!addressOverride) {
                alert(`✅ Order Placed! \n\nOrder ID: ${data.orderId}\nCheck your email (${userEmail}) for the receipt.`);
                
                // ⚠️ NEW: Refresh the data instantly so stock updates!
                if (window.location.pathname.includes("product.html")) {
                     await loadProductDetail(); // Refresh Detail Page
                } else {
                     await loadProducts();      // Refresh Home Grid
                     await loadCart();          // Ensure UI stays synced
                }
            }
            return true; 
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

async function checkoutCart() {
    if (!userToken) return;
    const userId = getUserId();

    const res = await fetch(`${CART_API_URL}?userId=${userId}`, { method: "GET", cache: "no-store" });
    const items = await res.json();

    if (items.length === 0) return alert("Your cart is empty!");

    const address = prompt("📦 Enter Shipping Address for ALL items:", "APIIT City Campus, Colombo");
    if (!address) return;

    let successCount = 0;
    const btn = document.getElementById("checkout-btn"); 
    if(btn) btn.innerText = "Processing...";

    for (const item of items) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
             const success = await buyNow(item.productId, item.name, item.price, address);
             if (success) successCount++;
        }
    }

    if(btn) btn.innerText = "Proceed to Checkout";

    if (successCount > 0) {
        alert(`✅ Checkout Complete! ${successCount} items ordered.\nCheck your email for receipts.`);
        for (const item of items) {
            await fetch(`${CART_API_URL}?userId=${userId}&productId=${item.productId}`, { method: "DELETE" });
        }
        
        // Refresh EVERYTHING correctly
        if (window.location.pathname.includes("product.html")) {
             await loadProductDetail();
        } else {
             await loadProducts();
             await loadCart();
        }
        
    } else {
        alert("❌ Checkout failed. Items might be out of stock.");
    }
}

function showCart() { 
    if (window.location.pathname.includes("product.html")) {
        window.location.href = "index.html#cart"; 
        return;
    }
    document.getElementById("product-page").classList.add("hidden"); 
    document.getElementById("cart-page").classList.remove("hidden");
}
function showHome() { 
    document.getElementById("product-page").classList.remove("hidden"); 
    document.getElementById("cart-page").classList.add("hidden"); 
}