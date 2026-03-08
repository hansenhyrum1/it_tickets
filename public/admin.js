import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { auth, db } from "./firebase-client.js";

const STATUS_OPTIONS = ["New", "In Progress", "Waiting", "Resolved", "Closed"];

const listEl = document.querySelector("#ticket-list");

const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const togglePassword = document.querySelector("#toggle-password");
const authLogin = document.querySelector("#auth-login");
const authStatus = document.querySelector("#auth-status");
const authError = document.querySelector("#auth-error");
const adminNote = document.querySelector("#admin-note");
const authSection = document.querySelector("#auth-section");
const accountSection = document.querySelector("#account-section");
const accountStatus = document.querySelector("#account-status");
const accountLogout = document.querySelector("#account-logout");
const ticketsSection = document.querySelector("#tickets-section");

let unsubscribe = null;
let isAdmin = false;

const showAuthError = (message) => {
  authError.textContent = message;
  authError.style.display = message ? "block" : "none";
};

const setAuthStatus = (message) => {
  authStatus.textContent = message || "";
  accountStatus.textContent = message || "";
};

const setAdminNote = (message) => {
  adminNote.textContent = message;
  adminNote.style.display = message ? "block" : "none";
};

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : null;
  return date ? date.toLocaleString() : "Pending timestamp";
};

const renderTickets = (tickets) => {
  listEl.innerHTML = "";

  if (!tickets.length) {
    listEl.innerHTML = "<p>No tickets yet.</p>";
    return;
  }

  tickets.forEach((ticket) => {
    const card = document.createElement("article");
    card.className = "ticket";

    const requester = ticket.requester || "Unknown requester";
    const issue = ticket.title || "Untitled issue";
    const description = ticket.description || "No description";
    const email = ticket.email || "No email";
    const importance = ticket.importance || "Medium";
    const status = ticket.status || "New";
    const statusClass = status.replace(/\s+/g, "-");

    const statusOptions = STATUS_OPTIONS.map(
      (value) => `<option value="${value}" ${value === status ? "selected" : ""}>${value}</option>`
    ).join("");

    card.innerHTML = `
      <div class="ticket-top">
        <h3>${requester} - ${issue}</h3>
        <div class="actions">
          <span class="status-pill status-${statusClass}">${status}</span>
          <span class="status-pill">${importance}</span>
        </div>
      </div>
      <p class="ticket-body">${description}</p>
      <div class="ticket-meta">
        <span><strong>Email:</strong> ${email}</span>
        <span><strong>Created:</strong> ${formatDate(ticket.createdAt)}</span>
        <span><strong>Updated:</strong> ${formatDate(ticket.updatedAt)}</span>
      </div>
      <div class="ticket-controls">
        <label for="status-${ticket.id}">Status</label>
        <select id="status-${ticket.id}" data-action="status" data-id="${ticket.id}">
          ${statusOptions}
        </select>
        <button type="button" class="secondary" data-action="delete" data-id="${ticket.id}">Delete Ticket</button>
      </div>
    `;

    listEl.appendChild(card);
  });
};

const stopListener = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

const attachListener = () => {
  stopListener();

  const ticketsQuery = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(
    ticketsQuery,
    (snapshot) => {
      const tickets = snapshot.docs.map((ticketDoc) => ({ id: ticketDoc.id, ...ticketDoc.data() }));
      renderTickets(tickets);
    },
    (error) => {
      setAdminNote(`Ticket read failed: ${error.message}`);
    }
  );
};

const handleLogin = async () => {
  showAuthError("");
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    showAuthError("Email and password are required.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    authPassword.value = "";
  } catch (error) {
    showAuthError(error.message);
  }
};

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleLogin();
});

authLogin.addEventListener("click", handleLogin);

accountLogout.addEventListener("click", async () => {
  await signOut(auth);
});

togglePassword.addEventListener("click", () => {
  const isHidden = authPassword.type === "password";
  authPassword.type = isHidden ? "text" : "password";
  togglePassword.textContent = isHidden ? "Hide" : "Show";
});

listEl.addEventListener("change", async (event) => {
  if (!isAdmin) return;

  const target = event.target;
  if (target.dataset.action !== "status") return;

  const id = target.dataset.id;
  const nextStatus = target.value;

  try {
    await updateDoc(doc(db, "tickets", id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    setAdminNote("");
  } catch (error) {
    setAdminNote(`Status update failed: ${error.message}`);
  }
});

listEl.addEventListener("click", async (event) => {
  if (!isAdmin) return;

  const target = event.target;
  if (target.dataset.action !== "delete") return;

  const id = target.dataset.id;
  const confirmed = window.confirm("Delete this ticket permanently?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "tickets", id));
    setAdminNote("");
  } catch (error) {
    setAdminNote(`Delete failed: ${error.message}`);
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    isAdmin = false;
    setAuthStatus("Signed out");
    setAdminNote("");
    authSection.style.display = "block";
    accountSection.style.display = "none";
    stopListener();
    renderTickets([]);
    ticketsSection.style.display = "none";
    return;
  }

  setAuthStatus(`Signed in as ${user.email}`);
  setAdminNote("Checking admin access...");
  authSection.style.display = "none";
  accountSection.style.display = "block";
  ticketsSection.style.display = "none";

  getDoc(doc(db, "admins", user.uid))
    .then((adminDoc) => {
      if (!adminDoc.exists()) {
        isAdmin = false;
        setAdminNote("Access denied: this account is not in admins/{uid}.");
        stopListener();
        renderTickets([]);
        ticketsSection.style.display = "none";
        return;
      }

      isAdmin = true;
      setAdminNote("");
      ticketsSection.style.display = "block";
      attachListener();
    })
    .catch((error) => {
      isAdmin = false;
      setAdminNote(`Admin check failed: ${error.message}`);
      stopListener();
      renderTickets([]);
      ticketsSection.style.display = "none";
    });
});
