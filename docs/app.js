import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";
import { db, storage } from "./firebase-client.js";

const form = document.querySelector("#ticket-form");
const successEl = document.querySelector("#success-message");
const submitButton = form?.querySelector("button[type='submit']");
const defaultSubmitLabel = submitButton?.textContent || "Submit Ticket";
const attachmentsInput = document.querySelector("#attachments");
const selectedAttachmentsEl = document.querySelector("#selected-attachments");

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const sanitizeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const formatFileSize = (size) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(size / 1024)} KB`;
};

const stagedFiles = [];

const showError = (message) => {
  successEl.textContent = message;
  successEl.style.display = "block";
};

const setSubmittingState = (isSubmitting) => {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  submitButton.classList.toggle("is-loading", isSubmitting);
  submitButton.setAttribute("aria-busy", isSubmitting ? "true" : "false");
  submitButton.textContent = isSubmitting ? "Submitting..." : defaultSubmitLabel;
};

const renderSelectedAttachments = () => {
  if (!selectedAttachmentsEl) return;

  if (!stagedFiles.length) {
    selectedAttachmentsEl.innerHTML = "";
    selectedAttachmentsEl.style.display = "none";
    return;
  }

  selectedAttachmentsEl.style.display = "grid";
  selectedAttachmentsEl.innerHTML = stagedFiles
    .map(
      (file, index) => `
        <div class="selected-attachment" data-index="${index}">
          <span class="selected-attachment-name">${file.name}</span>
          <span class="selected-attachment-size">${formatFileSize(file.size)}</span>
          <button type="button" class="secondary selected-attachment-remove" data-action="remove-attachment" data-index="${index}">Remove</button>
        </div>
      `
    )
    .join("");
};

if (attachmentsInput) {
  attachmentsInput.addEventListener("change", () => {
    successEl.style.display = "none";
    const incoming = Array.from(attachmentsInput.files || []);

    if (!incoming.length) return;

    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        showError(`\"${file.name}\" is not an image.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showError(`\"${file.name}\" is larger than 10 MB.`);
        continue;
      }
      if (stagedFiles.length >= MAX_FILES) {
        showError(`You can attach up to ${MAX_FILES} images.`);
        break;
      }

      stagedFiles.push(file);
    }

    attachmentsInput.value = "";
    renderSelectedAttachments();
  });
}

if (selectedAttachmentsEl) {
  selectedAttachmentsEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== "remove-attachment") return;

    const index = Number.parseInt(target.dataset.index || "", 10);
    if (Number.isNaN(index) || index < 0 || index >= stagedFiles.length) return;

    stagedFiles.splice(index, 1);
    renderSelectedAttachments();
    successEl.style.display = "none";
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    successEl.style.display = "none";
    setSubmittingState(true);

    const data = new FormData(form);
    const files = [...stagedFiles];

    const ticketRef = doc(collection(db, "tickets"));
    let attachments = [];

    const ticket = {
      title: data.get("title").trim(),
      description: data.get("description").trim(),
      requester: data.get("requester").trim(),
      email: data.get("email").trim(),
      device: data.get("device").trim(),
      importance: data.get("importance"),
      status: "New",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (files.length) {
        const now = Date.now();
        attachments = await Promise.all(
          files.map(async (file, index) => {
            const path = `tickets/${ticketRef.id}/attachments/${now}-${index}-${sanitizeFileName(file.name)}`;
            const uploadRef = ref(storage, path);
            await uploadBytes(uploadRef, file, { contentType: file.type });
            const url = await getDownloadURL(uploadRef);
            return {
              contentType: file.type,
              name: file.name,
              path,
              size: file.size,
              url,
            };
          })
        );
      }

      await setDoc(ticketRef, { ...ticket, attachments });
      form.reset();
      stagedFiles.length = 0;
      renderSelectedAttachments();
      successEl.textContent = files.length
        ? `Ticket submitted with ${files.length} attachment(s).`
        : "Ticket submitted.";
      successEl.style.display = "block";
    } catch (error) {
      successEl.textContent = `Failed to submit ticket: ${error.message}`;
      successEl.style.display = "block";
    } finally {
      setSubmittingState(false);
    }
  });
}
