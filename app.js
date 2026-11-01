
/* AIMSETTING YANZX77 storefront */
(() => {
  const cfg = window.APP_CONFIG || {};

  const ready =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    window.supabase;

  const sb = ready
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      )
    : null;

  const $ = s => document.querySelector(s);

  const money = n =>
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR"
    }).format(Number(n || 0));

  const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  let products = [];
  let cart = JSON.parse(sessionStorage.getItem("ays_cart") || "[]");
  let user = null;

  const setNotice = msg => {
    const el = $("#notice");
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
    }
  };

  const hideNotice = () => $("#notice")?.classList.add("hidden");

  const call = async promise => {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  };

  async function getUser() {
    if (!sb) return null;

    const { data, error } = await sb.auth.getUser();

    if (error) {
      user = null;
      return null;
    }

    user = data?.user || null;
    return user;
  }

  async function checkAdmin() {
    if (!sb || !user) return false;

    const { data, error } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return false;

    return data?.role === "admin";
  }

  function updateCartCount() {
    const count = cart.reduce((a, x) => a + x.quantity, 0);

    if ($("#cartCount")) {
      $("#cartCount").textContent = count;
    }

    sessionStorage.setItem("ays_cart", JSON.stringify(cart));
  }

  function renderProducts() {
    const grid = $("#productGrid");
    if (!grid) return;

    const query = ($("#searchInput")?.value || "").toLowerCase().trim();
    const category = $("#categoryFilter")?.value || "";

    const visible = products.filter(p =>
      p.is_active &&
      (!query ||
        (p.name + " " + p.description + " " + p.category)
          .toLowerCase()
          .includes(query)) &&
      (!category || p.category === category)
    );

    grid.innerHTML = visible.length
      ? visible.map(p => `
        <article class="product-card">
          <div class="product-image">
            ${
              p.image_url
                ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">`
                : `<span class="image-fallback">A<span style="color:#dbeafe">/</span>S</span>`
            }
            <span class="product-tag">${esc(p.category)}</span>
          </div>

          <div class="product-body">
            <h3>${esc(p.name)}</h3>
            <p>${esc(p.description || "Digital gaming product. Read the details before purchase.")}</p>

            <div class="product-bottom">
              <div>
                <div class="price">${money(p.price)}</div>
                <div class="stock ${p.stock < 4 ? "low" : ""}">
                  ${p.stock > 0 ? `${p.stock} available` : "Out of stock"}
                </div>
              </div>

              <button
                class="btn btn-primary"
                data-add="${p.id}"
                ${p.stock < 1 ? "disabled" : ""}
              >
                ${p.stock < 1 ? "Sold out" : "Add +"}
              </button>
            </div>
          </div>
        </article>
      `).join("")
      : `<div class="empty-state">No products found. Check back soon.</div>`;

    grid.querySelectorAll("[data-add]").forEach(button => {
      button.addEventListener("click", () => addToCart(button.dataset.add));
    });
  }

  async function loadProducts() {
    if (!sb) {
      setNotice("Setup needed: check config.js and your Supabase settings.");

      if ($("#productGrid")) {
        $("#productGrid").innerHTML =
          '<div class="empty-state">Connect your Supabase project to load products.</div>';
      }

      return;
    }

    try {
      products = await call(
        sb.from("products")
          .select("id,name,description,category,image_url,price,stock,is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
      );

      hideNotice();
      renderProducts();

    } catch (e) {
      setNotice("Could not load products. " + e.message);

      if ($("#productGrid")) {
        $("#productGrid").innerHTML =
          '<div class="empty-state">Products could not be loaded.</div>';
      }
    }
  }

  function addToCart(id) {
    const p = products.find(x => x.id === id);
    if (!p || p.stock < 1) return;

    const row = cart.find(x => x.id === id);

    if (row) {
      if (row.quantity >= p.stock) {
        alert("Maximum available stock reached.");
        return;
      }

      row.quantity++;

    } else {
      cart.push({ id, quantity: 1 });
    }

    updateCartCount();
    renderCart();
    $("#cartDrawer")?.classList.remove("hidden");
  }

  function renderCart() {
    const area = $("#cartItems");
    if (!area) return;

    area.innerHTML = cart.length
      ? cart.map(row => {
          const p = products.find(x => x.id === row.id);
          if (!p) return "";

          return `
            <div class="cart-row">
              <div>
                <h4>${esc(p.name)}</h4>
                <small>${money(p.price)} each</small>

                <div class="qty">
                  <button data-dec="${p.id}">−</button>
                  <span>${row.quantity}</span>
                  <button data-inc="${p.id}">+</button>
                  <button class="remove" data-remove="${p.id}">Remove</button>
                </div>
              </div>

              <strong>${money(p.price * row.quantity)}</strong>
            </div>
          `;
        }).join("")
      : '<div class="empty-state">Your cart is empty.</div>';

    const total = cart.reduce(
      (sum, row) =>
        sum + (products.find(p => p.id === row.id)?.price || 0) * row.quantity,
      0
    );

    if ($("#cartTotal")) {
      $("#cartTotal").textContent = money(total);
    }

    area.querySelectorAll("[data-dec]").forEach(b => {
      b.onclick = () => changeQty(b.dataset.dec, -1);
    });

    area.querySelectorAll("[data-inc]").forEach(b => {
      b.onclick = () => changeQty(b.dataset.inc, 1);
    });

    area.querySelectorAll("[data-remove]").forEach(b => {
      b.onclick = () => {
        cart = cart.filter(x => x.id !== b.dataset.remove);
        updateCartCount();
        renderCart();
      };
    });
  }

  function changeQty(id, delta) {
    const row = cart.find(x => x.id === id);
    const p = products.find(x => x.id === id);

    if (!row || !p) return;

    row.quantity += delta;

    if (row.quantity < 1) {
      cart = cart.filter(x => x.id !== id);

    } else if (row.quantity > p.stock) {
      row.quantity = p.stock;
      alert("Maximum available stock reached.");
    }

    updateCartCount();
    renderCart();
  }

  async function beginCheckout() {
    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    if (!sb) {
      alert("Connect Supabase first by editing config.js.");
      return;
    }

    const u = await getUser();

    if (!u) {
      location.href = "account.html?signin=1";
      return;
    }

    $("#cartDrawer")?.classList.add("hidden");

    if ($("#checkoutError")) {
      $("#checkoutError").textContent = "";
    }

    $("#checkoutModal")?.classList.remove("hidden");
  }

  async function notifyTelegram(orderId) {
    if (!sb) return;

    const { error } = await sb.functions.invoke(
      "telegram-order-notify",
      {
        body: {
          order_id: orderId
        }
      }
    );

    if (error) {
      console.error("Telegram notification error:", error);
      throw error;
    }
  }

  async function submitCheckout(e) {
    e.preventDefault();

    // Save form reference before any async operation.
    const form = e.currentTarget;

    if (!(form instanceof HTMLFormElement)) {
      console.error("Checkout form not found.");
      return;
    }

    const fd = new FormData(form);
    const error = $("#checkoutError");

    if (error) error.textContent = "";

    if (!sb) {
      if (error) error.textContent = "Supabase is not connected.";
      return;
    }

    const customerName = String(fd.get("customer_name") || "").trim();
    const whatsapp = String(fd.get("whatsapp") || "").trim();
    const paymentNote = String(fd.get("payment_note") || "").trim();
    const device = String(fd.get("device") || "").trim();
    const username = String(fd.get("username") || "").trim();

    if (!customerName || !whatsapp || !device || !username) {
      if (error) {
        error.textContent = "Please complete all required fields.";
      }
      return;
    }

    const items = cart.map(x => ({
      product_id: x.id,
      quantity: x.quantity
    }));

    if (!items.length) {
      if (error) error.textContent = "Your cart is empty.";
      return;
    }

    const button = form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = "Creating order…";
    }

    try {
      const u = await getUser();

      if (!u) {
        if (error) error.textContent = "Please sign in again.";
        return;
      }

      // Create order in Supabase.
      const data = await call(
        sb.rpc("create_order", {
          p_customer_name: customerName,
          p_whatsapp: whatsapp,
          p_payment_note: paymentNote,
          p_items: items
        })
      );

      // Save device and game username to the new order.
      await call(
        sb.rpc("update_order_checkout_details", {
          p_order_id: data.order_id,
          p_device: device,
          p_username: username
        })
      );

      // Clear cart after order and details are saved.
      cart = [];
      updateCartCount();

      $("#checkoutModal")?.classList.add("hidden");

      if ($("#successText")) {
        $("#successText").textContent =
          "Your order has been created successfully.";
      }

      const qr = $("#paymentQR");

      if (qr) {
        qr.src = cfg.PAYMENT_QR_URL || "";
        qr.style.display = cfg.PAYMENT_QR_URL ? "block" : "none";
      }

      if ($("#paymentName")) {
        $("#paymentName").textContent =
          cfg.PAYMENT_NAME || cfg.STORE_NAME || "";
      }

      if ($("#paymentAmount")) {
        $("#paymentAmount").textContent = money(data.total);
      }

      if ($("#paymentOrderId")) {
        $("#paymentOrderId").textContent =
          "Order ID: " + data.order_id;
      }

      $("#successModal")?.classList.remove("hidden");

      // Send Telegram notification.
      notifyTelegram(data.order_id).catch(err => {
        console.error("Telegram notification failed:", err);
      });

      await loadProducts();

    } catch (err) {
      console.error("Checkout error:", err);

      if (error) {
        error.textContent =
          err.message || "Unable to create order. Please try again.";
      }

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Place order";
      }
    }
  }

  async function initStore() {
    if ($("#year")) {
      $("#year").textContent = new Date().getFullYear();
    }

    await getUser();

    if (await checkAdmin()) {
      $("#adminLink")?.classList.remove("hidden");
    }

    await loadProducts();

    updateCartCount();
    renderCart();

    $("#searchInput")?.addEventListener("input", renderProducts);
    $("#categoryFilter")?.addEventListener("change", renderProducts);

    $("#cartButton")?.addEventListener("click", () => {
      $("#cartDrawer")?.classList.remove("hidden");
      renderCart();
    });

    $("#closeCart")?.addEventListener("click", () => {
      $("#cartDrawer")?.classList.add("hidden");
    });

    $("#checkoutButton")?.addEventListener("click", beginCheckout);

    $("#closeCheckout")?.addEventListener("click", () => {
      $("#checkoutModal")?.classList.add("hidden");
    });

    $("#checkoutForm")?.addEventListener("submit", submitCheckout);

    $("#closeSuccess")?.addEventListener("click", () => {
      $("#successModal")?.classList.add("hidden");
    });
  }

  window.AYS = {
    sb,
    call,
    money,
    esc,
    getUser,
    checkAdmin,
    setNotice
  };

  if ($("#productGrid")) {
    initStore();
  }
})();
