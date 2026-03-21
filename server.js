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
      id: parsed.pointId || parsed.name || null,        // np. "inpost:OLK04M"
      code: parsed.name || null,                        // np. "OLK04M"
      address: parsed.address || null,                  // np. "20-tu Straconych 6A"
      city: parsed.city || null,                        // np. "Olkusz"
      postcode: parsed.postCode || null,                // np. "32-300"
      provider: parsed.providerTitle || parsed.providerName || null, // np. "InPost"
      title: parsed.title || null                       // np. "Paczkomat 24/7"
    };
  } catch (e) {
    console.error("Nie udalo sie odczytac _pickup_point:", e.message);
    return null;
  }
}

app.get("/", (req, res) => {
  res.send("Aplikacja działa");
});

app.post("/webhook/orders-create", async (req, res) => {
  try {
    const order = req.body;
    const pickup = getPickupPoint(order);
    const isPickup = !!pickup;

    const payloadForFurgonetka = {
      order_id: order.id,
      order_name: order.name,
      receiver: {
        name: order.shipping_address?.name || "",
        first_name: order.shipping_address?.first_name || "",
        last_name: order.shipping_address?.last_name || "",
        company: "",
        phone: order.shipping_address?.phone || order.billing_address?.phone || "",
        email: order.email || order.contact_email || "",
        address: isPickup ? pickup.address : order.shipping_address?.address1 || "",
        address2: isPickup ? "" : order.shipping_address?.address2 || "",
        city: isPickup ? pickup.city : order.shipping_address?.city || "",
        postcode: isPickup ? pickup.postcode : order.shipping_address?.zip || "",
        country_code: order.shipping_address?.country_code || "PL"
      },
      pickup_point: isPickup
        ? {
            provider: pickup.provider,
            id: pickup.id,
            code: pickup.code,
            title: pickup.title,
            address: pickup.address,
            city: pickup.city,
            postcode: pickup.postcode
          }
        : null
    };

    console.log("=== ODEBRANE ZAMÓWIENIE ===");
    console.log(JSON.stringify(order, null, 2));

    console.log("=== PACZKOMAT ===");
    console.log(JSON.stringify(pickup, null, 2));

    console.log("=== DANE DLA FURGONETKI ===");
    console.log(JSON.stringify(payloadForFurgonetka, null, 2));

    // Tu potem odkomentujemy prawdziwą wysyłkę do Furgonetki
    /*
    const response = await axios.post(process.env.FURGONETKA_API_URL, payloadForFurgonetka, {
      headers: {
        Authorization: `Bearer ${process.env.FURGONETKA_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    console.log("=== ODPOWIEDŹ FURGONETKI ===");
    console.log(response.data);
    */

    res.status(200).send("OK");
  } catch (error) {
    console.error("Błąd:", error.response?.data || error.message);
    res.status(500).send("Błąd serwera");
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});