import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { db } from "./firebase-client.js";

const form = document.querySelector("#ticket-form");
const successEl = document.querySelector("#success-message");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    successEl.style.display = "none";

    const data = new FormData(form);
    const ticket = {
      title: data.get("title").trim(),
      description: data.get("description").trim(),
      requester: data.get("requester").trim(),
      email: data.get("email").trim(),
      department: data.get("department").trim(),
      importance: data.get("importance"),
      status: "New",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "tickets"), ticket);
      form.reset();
      successEl.textContent = "Ticket submitted.";
      successEl.style.display = "block";
    } catch (error) {
      successEl.textContent = `Failed to submit ticket: ${error.message}`;
      successEl.style.display = "block";
    }
  });
}
