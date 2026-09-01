let isLoggedIn = false;
let currentUser = null;
let currentCategory = "all";
let currentSearchQuery = "";
let selectedFiles = [];

// DOM Handles
const fileTableBody = document.getElementById("fileTableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const categoryFilters = document.getElementById("categoryFilters");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const filePreviewList = document.getElementById("filePreviewList");
const uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
const uploadForm = document.getElementById("uploadForm");
const uploadSection = document.getElementById("uploadSection");

// Modal Handles
const authBtn = document.getElementById("authBtn");
const userStatus = document.getElementById("userStatus");
const loginModal = document.getElementById("loginModal");
const loginModalClose = document.getElementById("loginModalClose");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

// Format Utilities
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Fetch and Render Files from SQLite API
async function loadFiles() {
  try {
    const url = `/api/files?category=${currentCategory}&search=${encodeURIComponent(currentSearchQuery)}`;
    const res = await fetch(url);
    const files = await res.json();

    fileTableBody.innerHTML = "";
    if (!files || files.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    files.forEach(file => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${file.original_filename}</strong></td>
        <td><span class="badge">${file.category.toUpperCase()}</span></td>
        <td>${formatBytes(file.file_size)}</td>
        <td>${formatDate(file.uploaded_at)}</td>
        <td>
          <button class="btn-action" onclick="handleView('${file.id}')">View</button>
          <button class="btn-action" onclick="handleDownload('${file.id}')">Download</button>
          <button class="btn-action" onclick="handleShare('${file.share_token}')">Share</button>
          ${isLoggedIn ? `<button class="btn-action btn-danger" onclick="handleDelete('${file.id}')">Delete</button>` : ''}
        </td>
      `;
      fileTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading files:", err);
  }
}

// Check Session Status
async function checkAuthStatus() {
  try {
    const res = await fetch("/api/auth/check");
    const data = await res.json();
    isLoggedIn = data.isLoggedIn;
    currentUser = data.username || null;
    updateUIAuth();
  } catch (err) {
    console.error("Failed to verify session:", err);
  }
}

function updateUIAuth() {
  if (isLoggedIn) {
    userStatus.textContent = `Logged in as ${currentUser}`;
    authBtn.textContent = "Logout";
    uploadSection.style.display = "block";
  } else {
    userStatus.textContent = "Guest Mode (Read Only)";
    authBtn.textContent = "Login";
    uploadSection.style.display = "none";
  }
  loadFiles();
}

// Event Listeners for Filters & Search
categoryFilters.addEventListener("click", (e) => {
  if (e.target.classList.contains("filter-btn")) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.getAttribute("data-category");
    loadFiles();
  }
});

searchInput.addEventListener("input", (e) => {
  currentSearchQuery = e.target.value;
  loadFiles();
});

// Drag and Drop & Browse Controls
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFileSelection(Array.from(e.target.files)));

dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("highlight"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("highlight"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("highlight");
  if (e.dataTransfer.files.length) handleFileSelection(Array.from(e.dataTransfer.files));
});

function handleFileSelection(files) {
  selectedFiles = files;
  filePreviewList.innerHTML = "";
  if (files.length > 0) {
    uploadSubmitBtn.disabled = false;
    files.forEach(f => {
      const item = document.createElement("div");
      item.className = "file-preview-item";
      item.innerHTML = `<span>${f.name}</span><span>${formatBytes(f.size)}</span>`;
      filePreviewList.appendChild(item);
    });
  } else {
    uploadSubmitBtn.disabled = true;
  }
}

// Upload Submission
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (selectedFiles.length === 0) return;

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append("files", f));

  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.textContent = "Uploading...";

  try {
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      selectedFiles = [];
      filePreviewList.innerHTML = "";
      fileInput.value = "";
      loadFiles();
    } else {
      const errData = await res.json();
      alert(`Upload failed: ${errData.error}`);
    }
  } catch (err) {
    alert("Network error occurred during upload");
  } finally {
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.textContent = "Upload Files";
  }
});

// File Action Handlers
window.handleView = function(id) {
  modalTitle.textContent = "File Preview";
  modalBody.innerHTML = `
    <div style="text-align: center;">
      <iframe src="/api/files/${id}/view" style="width: 100%; height: 350px; border: 1px solid #ccc; border-radius: 4px;"></iframe>
    </div>
  `;
  modal.classList.remove("hidden");
};

window.handleDownload = function(id) {
  window.location.href = `/api/files/${id}/download`;
};

window.handleShare = function(shareToken) {
  const shareUrl = `${window.location.origin}/share/${shareToken}`;
  modalTitle.textContent = "Share Link";
  modalBody.innerHTML = `
    <p>Direct link for external sharing:</p>
    <input type="text" readonly value="${shareUrl}" style="width:100%; padding: 0.5rem; margin-top: 0.5rem;">
  `;
  modal.classList.remove("hidden");
};

window.handleDelete = async function(id) {
  if (confirm("Are you sure you want to delete this file?")) {
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadFiles();
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error}`);
      }
    } catch (err) {
      alert("Error executing delete command");
    }
  }
};

// Auth Modal Triggering
authBtn.addEventListener("click", () => {
  if (isLoggedIn) handleLogout();
  else loginModal.classList.remove("hidden");
});

loginModalClose.addEventListener("click", () => loginModal.classList.add("hidden"));
modalClose.addEventListener("click", () => modal.classList.add("hidden"));

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");

  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      isLoggedIn = true;
      currentUser = data.username;
      updateUIAuth();
      loginModal.classList.add("hidden");
      loginForm.reset();
    } else {
      loginError.textContent = data.error || "Login failed";
      loginError.classList.remove("hidden");
    }
  } catch (err) {
    loginError.textContent = "Network error";
    loginError.classList.remove("hidden");
  }
});

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  isLoggedIn = false;
  currentUser = null;
  updateUIAuth();
}

// Initial Run
checkAuthStatus();