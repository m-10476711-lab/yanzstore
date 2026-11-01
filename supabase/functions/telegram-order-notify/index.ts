
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeMarkdown = (value: unknown) =>
  String(value ?? "").replace(/([_*`\[\]])/g, "\\$1");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: userData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !userData.user) {
      throw new Error("Invalid user session");
    }

    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error("Missing order ID");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, customer_name, whatsapp, total, status, device, username, created_at"
      )
      .eq("id", order_id)
      .eq("user_id", userData.user.id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .eq("order_id", order_id);

    if (itemsError) {
      throw itemsError;
    }

    const productText = (items || []).map(item =>
      escapeMarkdown(
        `${item.product_name} x${item.quantity}`
      )
    ).join(", ");

    const orderTime = new Intl.DateTimeFormat("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(order.created_at));

    const message = [
      "🛒 *PAYMENT ITEM — AIMSETTING YANZX77*",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "Salam admin! Saya berminat untuk membuat pembelian dengan maklumat berikut:",
      "",
      `*PRODUK :* ${productText || "-"}`,
      `*DEVICE :* ${escapeMarkdown(order.device || "-")}`,
      `*JAM :* ${orderTime}`,
      `*PRICE :* RM${Number(order.total).toFixed(2)}`,
      `*USERNAME :* ${escapeMarkdown(order.username || "-")}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      `*ORDER ID :* ${escapeMarkdown(order.id)}`,
      `*CUSTOMER :* ${escapeMarkdown(order.customer_name)}`,
      `*WHATSAPP :* ${escapeMarkdown(order.whatsapp)}`,
      `*STATUS :* ${escapeMarkdown(order.status)}`,
      "",
      "Terima kasih, admin. Mohon bantu saya untuk proses pesanan ini. 🙏",
    ].join("\n");

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!token || !chatId) {
      throw new Error("Telegram secrets missing");
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        "Telegram API: " + JSON.stringify(result)
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
