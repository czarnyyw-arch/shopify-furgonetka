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
      code: parsed.name || null,
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

function buildFurgonetkaPackagePayload(order) {
  const pickupPoint = getPickupPoint(order);

  if (!pickupPoint || !pickupPoint.code) {
    throw new Error("Brak kodu paczkomatu w _pickup_point");
  }

  return {
    service_id: Number(process.env.FURGONETKA_SERVICE_ID || 1),

    pickup: {
      name: process.env.SENDER_NAME || "Nadawca",
      company: process.env.SENDER_COMPANY || "",
      street: process.env.SENDER_STREET || "UZUPELNIJ_ULICE",
      postcode: process.env.SENDER_POSTCODE || "00-000",
      city: process.env.SENDER_CITY || "UZUPELNIJ_MIASTO",
      country_code: process.env.SENDER_COUNTRY_CODE || "PL",
      phone: process.env.SENDER_PHONE || "000000000",
      email: process.env.SENDER_EMAIL || "test@test.pl"
    },

    receiver: {
      name: order.shipping_address?.name || "",
      company: "",
      street: pickupPoint.address || order.shipping_address?.address1 || "",
      postcode: pickupPoint.postcode || order.shipping_address?.zip || "",
      city: pickupPoint.city || order.shipping_address?.city || "",
      country_code: order.shipping_address?.country_code || "PL",
      phone: order.shipping_address?.phone || order.billing_address?.phone || "",
      email: order.email || order.contact_email || "",
      point: pickupPoint.code
    },

    parcels: [
      {
        weight: 1,
        width: 10,
        height: 10,
        length: 10
      }
    ]
  };
}

app.get("/", (req, res) => {
  res.send("Aplikacja działa");
});

app.post("/webhook/orders-create", async (req, res) => {
  try {
    const order = req.body;
    const pickupPoint = getPickupPoint(order);
    const payload = buildFurgonetkaPackagePayload(order);

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
          "Content-Type": "application/json",
          Accept: "application/vnd.furgonetka.v1+json"
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