import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { auth, db } from "./firebase-client.js";

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
const REQUIRE_LOGIN_EACH_VISIT = true;

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

const renderTickets = (tickets) => {
  listEl.innerHTML = "";

  if (!tickets.length) {
    listEl.innerHTML = "<p>No tickets yet.</p>";
    return;
  }

  tickets.forEach((ticket) => {
    const card = document.createElement("div");
    card.className = "ticket";

    const createdAt = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : null;
    const createdLabel = createdAt ? createdAt.toLocaleString() : "Pending timestamp";
    const statusClass = (ticket.status || "New").replace(/\s+/g, "-");

    card.innerHTML = `
      <h3>${ticket.title || "Untitled"}</h3>
      <small>${ticket.id} • ${createdLabel}</small>
      <p>${ticket.description || "No description"}</p>
      <small>Requester: ${ticket.requester || "Unknown"} • ${ticket.email || "No email"}</small><br>
      <small>Department: ${ticket.department || "Unspecified"}</small>
      <div style="margin-top: 10px;">
        <span class="status-pill status-${statusClass}">${ticket.status || "New"}</span>
        <span class="status-pill">${ticket.importance || "Medium"}</span>
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
      const tickets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

onAuthStateChanged(auth, (user) => {
  if (!user) {
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
        setAdminNote("Access denied: this account is not in admins/{uid}.");
        stopListener();
        renderTickets([]);
        ticketsSection.style.display = "none";
        return;
      }

      setAdminNote("");
      ticketsSection.style.display = "block";
      attachListener();
    })
    .catch((error) => {
      setAdminNote(`Admin check failed: ${error.message}`);
      stopListener();
      renderTickets([]);
      ticketsSection.style.display = "none";
    });
});

if (REQUIRE_LOGIN_EACH_VISIT) {
  signOut(auth).catch(() => {});
}
