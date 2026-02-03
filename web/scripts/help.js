import { api } from "./api.js";

console.log("Help page loaded.");

const form = document.getElementById("supportForm");
const subjectInput = document.getElementById("supportSubject");
const messageInput = document.getElementById("supportMessage");
const statusEl = document.getElementById("supportStatus");
const submitButton = form?.querySelector("button[type='submit']");

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove("is-hidden");
}

function setLoading(isLoading) {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Sending..." : "Send Message";
}

if (form && subjectInput && messageInput) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const subject = subjectInput.value.trim();
    const message = messageInput.value.trim();

    if (!subject || !message) {
      setStatus("Please add both a subject and a message.");
      return;
    }

    setLoading(true);
    setStatus("Sending your message...");

    try {
      if (!api?.support?.contact) {
        throw new Error(
          "Support service isn't available yet. Please refresh the page or email support."
        );
      }

      await api.support.contact({ subject, message });
      setStatus("Thanks! Your message has been sent to support.");
      form.reset();
    } catch (error) {
      setStatus(error?.message || "Unable to send message right now.");
    } finally {
      setLoading(false);
    }
  });
}
