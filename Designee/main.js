// ✅ Entry point
document.addEventListener("DOMContentLoaded", async () => {
  setupLogoutButton();
  setupDropdownToggle();

  const userData = checkSession();
  if (!userData) return;

  if (userData.role !== "designee") {
    document.getElementById("staffTableContainer").style.display = "none";
    document.getElementById("openModalBtn").style.display = "none";
    document.getElementById("notDesigneeMessage").style.display = "block";
    return;
  }

  setupAddStaffModal();
  await getDesigneeInfoAndLoadStaff(userData.id);
  
});
// ---------- Modal Controls ----------
function setupAddStaffModal() {
  const openBtn = document.getElementById("openModalBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const generateBtn = document.getElementById("generateBtn");

  // Open modal
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modalOverlay.style.display = "flex"; // flex centers it
    });
  }

  // Close modal
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modalOverlay.style.display = "none";
      clearModalInputs();
    });
  }

  // Generate password
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const pass = Math.random().toString(36).slice(-8); // random 8-char password
      document.getElementById("generatedPassword").value = pass;
    });
  }

  // Save staff
  if (saveBtn) {
    saveBtn.addEventListener("click", saveNewStaff); // 👈 your function from staff.js
  }
}

// Reset inputs when closing
function clearModalInputs() {
  document.getElementById("staffId").value = "";
  document.getElementById("firstName").value = "";
  document.getElementById("lastName").value = "";
  document.getElementById("institutionalEmail").value = "";
  document.getElementById("generatedPassword").value = "";
}
