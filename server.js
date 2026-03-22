require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function getNoteAttr(order, key) {
  const attrs = order.note_attributes || [];
  const found = attrs.find((a) => a.name === key);
  return found ? found.value : null;
}

function getPickupPoint(order) {
  const raw = getNoteAttr(order, "_pickup_point");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    return {
      id: parsed.pointId || null,
      code: parsed.name || null, // np. OLK04M
      address: parsed.address || null,
      city: parsed.city || null,
      postcode: parsed.postCode || null,
      provider: parsed.providerTitle || parsed.providerName || null,
      title: parsed.title || null
    };
  } catch (e) {
    console.error("Nie udalo sie odczytac _pickup_point:", e.message);
    return null;
  }
}

function mapService(order) {
  const shippingCode = (order.shipping_lines?.[0]?.code || "").toLowerCase();
  const shippingTitle = (order.shipping_lines?.[0]?.title || "").toLowerCase();

  if (shippingCode.includes("inpost") || shippingTitle.includes("inpost")) {
    return "inpost";
  }

  if (shippingCode.includes("dpd") || shippingTitle.includes("dpd")) {
    return "dpd";
  }

  if (shippingCode.includes("gls") || shippingTitle.includes("gls")) {
    return "gls";
  }

  if (shippingCode.includes("ups") || shippingTitle.includes("ups")) {
    return "ups";
  }

  return "inpost";
}

function buildProducts(order) {
  return (order.line_items || []).map((item) => ({
    name: item.title || item.name || "Produkt",
    quantity: item.quantity || 1,
    price: Number(item.price || 0)
  }));
}

function buildFurgonetkaOrderPayload(order) {
  const pickupPoint = getPickupPoint(order);

  if (!pickupPoint || !pickupPoint.code) {
    throw new Error("Brak kodu paczkomatu w _pickup_point");
  }

  return {
    cartId: String(order.id),
    datetimeOrder: order.created_at || new Date().toISOString(),
    service: mapService(order),
    point: pickupPoint.code, // KLUCZ: np. OLK04M
    codAmount: 0,
    comment: order.note || "",
    payment: {
      id: "paid"
    },
    shipping: {
      id: "shopify"
    },
    shippingAddress: {
      company: "",
      name: order.shipping_address?.first_name || "",
      surname: order.shipping_address?.last_name || "",
      street: order.shipping_address?.address1 || "",
      city: order.shipping_address?.city || "",
      postcode: order.shipping_address?.zip || "",
      countryCode: order.shipping_address?.country_code || "PL",
      phone: order.shipping_address?.phone || order.billing_address?.phone || "",
      email: order.email || order.contact_email || ""
    },
    invoiceAddress: {
      company: order.billing_address?.company || "",
      name:
        order.billing_address?.first_name ||
        order.shipping_address?.first_name ||
        "",
      surname:
        order.billing_address?.last_name ||
        order.shipping_address?.last_name ||
        "",
      street:
        order.billing_address?.address1 ||
        order.shipping_address?.address1 ||
        "",
      city:
        order.billing_address?.city ||
        order.shipping_address?.city ||
        "",
      postcode:
        order.billing_address?.zip ||
        order.shipping_address?.zip ||
        "",
      countryCode:
        order.billing_address?.country_code ||
        order.shipping_address?.country_code ||
        "PL",
      phone:
        order.billing_address?.phone ||
        order.shipping_address?.phone ||
        "",
      email: order.email || order.contact_email || ""
    },
    products: buildProducts(order)
  };
}

app.get("/", (req, res) => {
  res.send("Aplikacja działa");
});

app.post("/webhook/orders-create", async (req, res) => {
  try {
    const order = req.body;
    const pickupPoint = getPickupPoint(order);
    const payload = buildFurgonetkaOrderPayload(order);

    console.log("=== ODEBRANE ZAMOWIENIE ===");
    console.log(JSON.stringify(order, null, 2));

    console.log("=== PACZKOMAT ===");
    console.log(JSON.stringify(pickupPoint, null, 2));

    console.log("=== PAYLOAD DO FURGONETKI ===");
    console.log(JSON.stringify(payload, null, 2));

    console.log("=== URL FURGONETKI ===");
    console.log(process.env.FURGONETKA_API_URL);

    const response = await axios.post(
      process.env.FURGONETKA_API_URL,
      payload,
      {
        headers: {
          Authorization: process.env.FURGONETKA_API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log("=== ODPOWIEDZ FURGONETKI ===");
    console.log(JSON.stringify(response.data, null, 2));

    return res.status(200).send("OK");
  } catch (error) {
    console.error("=== BLAD ===");
    console.error(
      JSON.stringify(error.response?.data || { message: error.message }, null, 2)
    );
    return res.status(500).send("BLAD");
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});