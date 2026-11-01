/* AIMSETTING YANZX77 ADMIN DASHBOARD */
(() => {
  const $ = s => document.querySelector(s);

  const app = window.AYS;
  const sb = app?.sb;
  const esc = app?.esc || String;
  const money = app?.money || String;

  let allProducts = [];
  let allCategories = [];

  let editingCategory = null;

  const notice = (message, good = false) => {
    const el = $("#adminNotice");
    if (!el) return;

    el.textContent = message;
    el.style.color = good ? "#6ee7b7" : "#b9d9ff";
  };

  const categoryMessage = (message, good = false) => {
    const el = $("#categoryMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = good ? "#6ee7b7" : "#fca5a5";
  };

  async function init() {
    if (!sb) {
      notice("Configure config.js first.");
      return;
    }

    try {
      const user = await app.getUser();

      if (!user) {
        notice("Sign in with an admin account on the Account page, then return here.");
        return;
      }

      if (!(await app.checkAdmin())) {
        notice("Access denied. This account is not an admin.");
        return;
      }

      notice("Admin access verified.", true);

      $("#adminApp").classList.remove("hidden");

      await refresh();

    } catch (e) {
      notice("Could not verify admin access: " + e.message);
    }
  }

  async function refresh() {
    allProducts = await app.call(
      sb.from("products")
        .select("*")
        .order("created_at", { ascending: false })
    );

    const orders = await app.call(
      sb.from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)
    );

    $("#statProducts").textContent = allProducts.length;

    $("#statPending").textContent = orders.filter(o =>
      ["pending_payment", "payment_review"].includes(o.status)
    ).length;

    $("#statStock").textContent =
      allProducts.filter(p => p.stock < 4).length;

    await loadCategories();

    renderProducts();
    await renderOrders(orders);
  }

  // CATEGORY MANAGEMENT

  async function loadCategories() {
    allCategories = await app.call(
      sb.from("categories")
        .select("id,name,created_at")
        .order("name", { ascending: true })
    );

    renderCategories();
    updateProductCategorySelect();
  }

  function renderCategories() {
    const el = $("#categoriesAdmin");
    if (!el) return;

    if (!allCategories.length) {
      el.innerHTML = '<div class="empty-state">No categories yet. Add your first category above.</div>';
      return;
    }

    el.innerHTML = allCategories.map(category => {
      const productCount = allProducts.filter(
        p => p.category === category.name
      ).length;

      return `
        <div class="product-admin-row">
          <div>
            <strong>${esc(category.name)}</strong>
            <small>${productCount} product(s)</small>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button
              type="button"
              class="btn btn-ghost"
              data-edit-category="${category.id}"
            >
              Rename
            </button>

            <button
              type="button"
              class="btn btn-ghost"
              data-delete-category="${category.id}"
            >
              Delete
            </button>
          </div>
        </div>
      `;
    }).join("");

    el.querySelectorAll("[data-edit-category]").forEach(button => {
      button.onclick = () => {
        const category = allCategories.find(
          c => c.id === button.dataset.editCategory
        );

        if (category) editCategory(category);
      };
    });

    el.querySelectorAll("[data-delete-category]").forEach(button => {
      button.onclick = () => {
        const category = allCategories.find(
          c => c.id === button.dataset.deleteCategory
        );

        if (category) deleteCategory(category);
      };
    });
  }

  function updateProductCategorySelect(selected = "") {
    const select = $("#productCategory");
    if (!select) return;

    const previous = selected || select.value;

    select.innerHTML = allCategories.length
      ? '<option value="">Select category</option>' +
        allCategories.map(c => `
          <option value="${esc(c.name)}">${esc(c.name)}</option>
        `).join("")
      : '<option value="">Add a category first</option>';

    if (allCategories.some(c => c.name === previous)) {
      select.value = previous;
    }
  }

  async function saveCategory(e) {
    e.preventDefault();

    const input = $("#categoryName");
    const button = $("#categorySubmit");
    const name = input.value.trim();

    categoryMessage("");

    if (!name) {
      categoryMessage("Please enter a category name.");
      return;
    }

    if (name.length > 60) {
      categoryMessage("Category name must be 60 characters or fewer.");
      return;
    }

    button.disabled = true;

    try {
      if (editingCategory) {
        await app.call(
          sb.rpc("admin_rename_category", {
            p_old_name: editingCategory.name,
            p_new_name: name
          })
        );

        categoryMessage("Category renamed successfully.", true);

      } else {
        await app.call(
          sb.from("categories").insert({
            name
          })
        );

        categoryMessage("Category added successfully.", true);
      }

      resetCategoryForm();
      await refresh();

    } catch (error) {
      categoryMessage(error.message || "Could not save category.");

    } finally {
      button.disabled = false;
    }
  }

  function editCategory(category) {
    editingCategory = category;

    $("#categoryName").value = category.name;
    $("#categorySubmit").textContent = "Save category";
    $("#cancelCategoryEdit").classList.remove("hidden");

    categoryMessage("Editing: " + category.name, true);

    $("#categoryName").focus();
  }

  function resetCategoryForm() {
    editingCategory = null;

    $("#categoryForm").reset();
    $("#categorySubmit").textContent = "Add category";
    $("#cancelCategoryEdit").classList.add("hidden");
  }

  async function deleteCategory(category) {
    const productCount = allProducts.filter(
      p => p.category === category.name
    ).length;

    if (productCount > 0) {
      alert(
        `Cannot delete "${category.name}".\n\n` +
        `${productCount} product(s) still use this category.\n\n` +
        "Edit those products and move them to another category first."
      );
      return;
    }

    const confirmed = confirm(
      `Delete category "${category.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await app.call(
        sb.rpc("admin_delete_category", {
          p_name: category.name
        })
      );

      categoryMessage("Category deleted successfully.", true);

      if (editingCategory?.id === category.id) {
        resetCategoryForm();
      }

      await refresh();

    } catch (error) {
      categoryMessage(error.message || "Could not delete category.");
    }
  }

  // PRODUCT MANAGEMENT

  function renderProducts() {
    const el = $("#productsAdmin");

    el.innerHTML = allProducts.length
      ? allProducts.map(p => `
        <div class="product-admin-row">
          <div>
            <strong>${esc(p.name)}</strong>
            <small>
              ${money(p.price)} · stock ${p.stock} ·
              ${esc(p.category || "No category")} ·
              ${p.is_active ? "visible" : "hidden"}
            </small>
          </div>

          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost" data-edit="${p.id}">
              Edit
            </button>

            <button class="btn btn-ghost" data-toggle="${p.id}">
              ${p.is_active ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      `).join("")
      : '<div class="empty-state">No products yet.</div>';

    el.querySelectorAll("[data-edit]").forEach(button => {
      button.onclick = () => editProduct(button.dataset.edit);
    });

    el.querySelectorAll("[data-toggle]").forEach(button => {
      button.onclick = () => toggleProduct(button.dataset.toggle);
    });
  }

  function editProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;

    const f = $("#productForm");

    updateProductCategorySelect(p.category);

    for (const k of [
      "id",
      "name",
      "category",
      "price",
      "stock",
      "image_url",
      "description"
    ]) {
      f.elements[k].value = p[k] ?? "";
    }

    f.elements.is_active.checked = p.is_active;

    $("#productFormTitle").textContent = "Edit product";
    $("#cancelEdit").classList.remove("hidden");

    $("#productMessage").textContent =
      "Existing digital file is kept; upload a new file to replace it.";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function resetForm() {
    const f = $("#productForm");

    f.reset();
    f.elements.id.value = "";
    f.elements.is_active.checked = true;

    $("#productFormTitle").textContent = "Add product";
    $("#cancelEdit").classList.add("hidden");
    $("#productMessage").textContent = "";

    updateProductCategorySelect();
  }

  async function toggleProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;

    try {
      await app.call(
        sb.from("products")
          .update({
            is_active: !p.is_active
          })
          .eq("id", id)
      );

      await refresh();

    } catch (e) {
      alert("Update failed: " + e.message);
    }
  }

  async function saveProduct(e) {
    e.preventDefault();

    const f = e.currentTarget;
    const fd = new FormData(f);

    const msg = $("#productMessage");
    const btn = f.querySelector('[type="submit"]');

    msg.textContent = "";
    btn.disabled = true;

    try {
      const id = fd.get("id");
      const category = String(fd.get("category") || "").trim();

      if (!category) {
        throw new Error("Please select a category.");
      }

      if (!allCategories.some(c => c.name === category)) {
        throw new Error("Selected category does not exist. Refresh the page.");
      }

      const row = {
        name: String(fd.get("name") || "").trim(),
        category,
        price: Number(fd.get("price")),
        stock: Number(fd.get("stock")),
        image_url: fd.get("image_url") || null,
        description: String(fd.get("description") || "").trim(),
        is_active: f.elements.is_active.checked
      };

      let product;

      if (id) {
        product = await app.call(
          sb.from("products")
            .update(row)
            .eq("id", id)
            .select()
            .single()
        );

      } else {
        product = await app.call(
          sb.from("products")
            .insert(row)
            .select()
            .single()
        );
      }

      const file = f.elements.digital_file.files[0];

      if (file) {
        if (file.size > 25 * 1024 * 1024) {
          throw new Error("Digital file max size is 25 MB.");
        }

        const safeFileName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const path =
          `${product.id}/${crypto.randomUUID()}-${safeFileName}`;

        const up = await sb.storage
          .from("digital-files")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false
          });

        if (up.error) throw up.error;

        await app.call(
          sb.from("product_files").insert({
            product_id: product.id,
            file_name: file.name,
            storage_path: path
          })
        );
      }

      msg.textContent = "Product saved.";
      msg.style.color = "#6ee7b7";

      resetForm();
      await refresh();

    } catch (err) {
      msg.textContent = err.message || "Could not save product.";
      msg.style.color = "#fca5a5";

    } finally {
      btn.disabled = false;
    }
  }

  // ORDER MANAGEMENT

  async function renderOrders(orders) {
    const el = $("#ordersAdmin");

    if (!orders.length) {
      el.innerHTML = '<div class="empty-state">No orders yet.</div>';
      return;
    }

    const emailMap = {};

    for (const o of orders) {
      emailMap[o.id] = o.user_id
        ? o.user_id.slice(0, 8) + "…"
        : "Unknown";
    }

    el.innerHTML = orders.map(o => `
      <article class="order-card">

        <div class="order-top">
          <strong>
            Order ${esc(o.id.slice(0, 8).toUpperCase())}
            · ${esc(o.customer_name)}
          </strong>

          <span class="status ${esc(o.status)}">
            ${esc(o.status.replaceAll("_", " "))}
          </span>
        </div>

        <div class="order-items">
          ${new Date(o.created_at).toLocaleString()}
          <br>
          WhatsApp: ${esc(o.whatsapp)}
          <br>
          Device: ${esc(o.device || "—")}
          <br>
          Username: ${esc(o.username || "—")}
          <br>
          Total: <strong>${money(o.total)}</strong>
          <br>
          Customer ID: ${esc(emailMap[o.id])}
        </div>

        <div id="adminitems-${o.id}" class="order-items">
          Loading items…
        </div>

        <div class="admin-order-actions">

          ${
            o.payment_proof_path
              ? `<button class="btn btn-ghost" data-proof="${o.id}">
                  Open payment proof
                </button>`
              : ""
          }

          <select data-status="${o.id}">
            <option value="pending_payment" ${o.status === "pending_payment" ? "selected" : ""}>Pending payment</option>
            <option value="payment_review" ${o.status === "payment_review" ? "selected" : ""}>Payment review</option>
            <option value="paid" ${o.status === "paid" ? "selected" : ""}>Paid</option>
            <option value="processing" ${o.status === "processing" ? "selected" : ""}>Processing</option>
            <option value="completed" ${o.status === "completed" ? "selected" : ""}>Completed</option>
            <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>

          <button class="btn btn-primary" data-save-status="${o.id}">
            Update status
          </button>

        </div>
      </article>
    `).join("");

    for (const o of orders) {
      const items = await app.call(
        sb.from("order_items")
          .select("*")
          .eq("order_id", o.id)
      );

      const itemEl = $(`#adminitems-${o.id}`);

      if (itemEl) {
        itemEl.innerHTML = items.map(i =>
          `${esc(i.product_name)} × ${i.quantity} — ${money(i.unit_price * i.quantity)}`
        ).join("<br>");
      }
    }

    el.querySelectorAll("[data-proof]").forEach(button => {
      button.onclick = () => {
        openProof(orders.find(o => o.id === button.dataset.proof));
      };
    });

    el.querySelectorAll("[data-save-status]").forEach(button => {
      button.onclick = () => updateStatus(button.dataset.saveStatus);
    });
  }

  async function openProof(order) {
    if (!order?.payment_proof_path) return;

    try {
      const { data, error } = await sb.storage
        .from("payment-proofs")
        .createSignedUrl(order.payment_proof_path, 120);

      if (error) throw error;

      window.open(data.signedUrl, "_blank", "noopener");

    } catch (e) {
      alert("Could not open proof: " + e.message);
    }
  }

  async function updateStatus(id) {
    const status = $(`[data-status="${id}"]`).value;

    try {
      await app.call(
        sb.rpc("admin_update_order_status", {
          p_order_id: id,
          p_status: status
        })
      );

      await refresh();
      alert("Order status updated.");

    } catch (e) {
      alert("Could not update order: " + e.message);
    }
  }

  // EVENTS

  $("#cancelEdit").onclick = resetForm;

  $("#productForm").addEventListener("submit", saveProduct);

  $("#categoryForm").addEventListener("submit", saveCategory);

  $("#cancelCategoryEdit").onclick = () => {
    resetCategoryForm();
    categoryMessage("");
  };

  init();
})();
