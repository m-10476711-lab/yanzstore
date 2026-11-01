import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      return json({ error: "Telegram secrets are missing." }, 500);
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Invalid user session." }, 401);
    }

    const body = await req.json();
    const orderId = body.order_id;

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(orderId)
    ) {
      return json({ error: "Invalid order ID." }, 400);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,user_id,customer_name,whatsapp,total,status,created_at")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      return json({ error: "Order not found." }, 404);
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name,quantity,unit_price")
      .eq("order_id", orderId);

    if (itemsError) {
      return json({ error: "Could not load order items." }, 500);
    }

    const itemLines = (items || []).map((item) => {
      const subtotal = Number(item.unit_price) * Number(item.quantity);

      return `• ${item.product_name} x${item.quantity} — RM ${subtotal.toFixed(2)}`;
    });

    const message = [
      "🛒 NEW ORDER — AIMSETTING YANZX77",
      "",
      `Order ID: ${order.id}`,
      `Customer: ${order.customer_name}`,
      `WhatsApp: ${order.whatsapp}`,
      "",
      "PRODUCTS:",
      ...itemLines,
      "",
      `TOTAL: RM ${Number(order.total).toFixed(2)}`,
      `STATUS: ${order.status}`,
      "",
      "Please review this order in the admin dashboard."
    ].join("\n");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram API error:", telegramResult);
      return json({ error: "Telegram message could not be sent." }, 502);
    }

    return json({ success: true });

  } catch (error) {
    console.error(error);
    return json({ error: "Internal server error." }, 500);
  }
});
