// main.js
document.addEventListener("DOMContentLoaded", async () => {
  // 🔽 Dropdown toggle
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // Display username
  const usernameDisplay = document.getElementById("usernameDisplay");
  let designeeFullName = ""; // initialize
  const userDataString = localStorage.getItem("userData");
  if (userDataString) {
    try {
      const userDataObj = JSON.parse(userDataString);
      const firstName = userDataObj.firstName || "";
      const lastName = userDataObj.lastName || "";
      designeeFullName = `${firstName} ${lastName}`.trim();
    } catch (err) {
      console.error(err);
    }
  }
  usernameDisplay.textContent = designeeFullName;

  // Load initial data
  await loadUserRoleDisplay();
  await getCurrentUserData();
  await loadRequirements();

  // 🔹 Logout
  document.getElementById("logoutBtn")?.addEventListener("click", e => {
    e.preventDefault();
    ["userData","studentName","schoolID","studentID","staffID","designeeID","category","office","department"]
      .forEach(key => localStorage.removeItem(key));
    window.location.href = "../../logout.html";
  });

  // 🔹 Add requirement button
  const addRequirementBtn = document.getElementById("addRequirementBtn");
  addRequirementBtn?.addEventListener("click", async () => {
    const input = document.getElementById("newRequirementInput");
    const text = input.value.trim();
    if (!text) return alert("Enter a requirement.");

    // Disable button while processing
    addRequirementBtn.disabled = true;
    addRequirementBtn.textContent = "Adding...";

    try {
      await addRequirement(text);
      input.value = ""; // clear input after successful addition
    } catch (err) {
      console.error("Error adding requirement:", err);
      alert("Failed to add requirement.");
    } finally {
      // Re-enable button
      addRequirementBtn.disabled = false;
      addRequirementBtn.textContent = "Add Requirement";
    }
  });

  // 🔹 Edit modal
  document.getElementById("saveEditBtn")?.addEventListener("click", async () => {
    const text = document.getElementById("editRequirementInput").value.trim();
    if (!text) return alert("Cannot be empty.");

    const saveEditBtn = document.getElementById("saveEditBtn");
    saveEditBtn.disabled = true;
    saveEditBtn.textContent = "Saving...";

    try {
      await saveEditedRequirement(text);
    } catch (err) {
      console.error("Error saving requirement:", err);
      alert("Failed to save.");
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.textContent = "Save";
    }
  });
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => closeModal(document.getElementById("editModal")));

  // 🔹 Delete modal
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", async () => {
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = "Deleting...";

    try {
      await deleteRequirement();
    } catch (err) {
      console.error("Error deleting requirement:", err);
      alert("Failed to delete.");
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Delete";
    }
  });
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => closeModal(document.getElementById("deleteModal")));
});
