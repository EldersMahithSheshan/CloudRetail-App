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
// --- HELPER: Get Real User ID from Token ---
function getUserId() {
    if (!userToken) return null;
    const payload = JSON.parse(atob(userToken.split('.')[1]));
    return payload.sub; // 'sub' is the unique User ID in Cognito
}

// --- LOGOUT ---
function handleLogout() {
    localStorage.removeItem("userToken");
    // Redirect to Cognito Logout, then back to Index
    window.location.href = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${LOGIN_PAGE}`;
}

// --- PRODUCTS ---
async function loadProducts() {
   if (!userToken) return;
    const userId = getUserId(); // Get ID

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

// --- CART (FIXED) ---
// --- 2. ADD TO CART (Send ID in Body) ---
async function addToCart(id, name, price) {
    if (!userToken) return alert("Please login first");
    const userId = getUserId(); // Get ID

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
   const userId = getUserId();
    await fetch(`${CART_API_URL}?userId=${userId}&productId=${productId}`, { method: "DELETE" });
    loadCart();
}

// --- ORDER ---
async function buyNow(productId, productName, price) {
    if (!userToken) return alert("Please Sign In first!");

    // 1. Get User Details from Token
    // We decode the token to find out who is logged in
    const payload = JSON.parse(atob(userToken.split('.')[1]));
    const userName = payload['cognito:username'] || "Valued Customer";
    const userEmail = payload['email'];

    // 2. Ask for Address (The "Smart Path")
    const address = prompt("📦 Please enter your Shipping Address:", "APIIT City Campus, Colombo");
    
    if (!address) return; // Stop if user pressed Cancel
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
                userId: payload.sub, // Unique User ID from AWS
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