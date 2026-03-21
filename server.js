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

app.get("/", (req, res) => {
  res.send("Aplikacja działa");
});

app.post("/webhook/orders-create", async (req, res) => {
  try {
    const order = req.body;

    const pickupPointId = getNoteAttr(order, "PickupPointId");
    const pickupPointName = getNoteAttr(order, "PickupPointName");
    const pickupPointAddress = getNoteAttr(order, "PickupPointAddress");
    const pickupPointPostCode = getNoteAttr(order, "PickupPointPostCode");
    const pickupPointCity = getNoteAttr(order, "PickupPointCity");
    const pickupPointCourier = getNoteAttr(order, "PickupPointCourier");

    const isPickup = !!pickupPointId;

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
        address: isPickup ? pickupPointAddress : order.shipping_address?.address1 || "",
        address2: isPickup ? "" : order.shipping_address?.address2 || "",
        city: isPickup ? pickupPointCity : order.shipping_address?.city || "",
        postcode: isPickup ? pickupPointPostCode : order.shipping_address?.zip || "",
        country_code: order.shipping_address?.country_code || "PL"
      },
      pickup_point: isPickup
        ? {
            courier: pickupPointCourier,
            id: pickupPointId,
            name: pickupPointName,
            address: pickupPointAddress,
            city: pickupPointCity,
            postcode: pickupPointPostCode
          }
        : null
    };

    console.log("=== ODEBRANE ZAMÓWIENIE ===");
    console.log(JSON.stringify(order, null, 2));

    console.log("=== DANE DLA FURGONETKI ===");
    console.log(JSON.stringify(payloadForFurgonetka, null, 2));

    // TU DOCZELOWO ODKOMENTUJESZ WYSYŁKĘ DO FURGONETKI:
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