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
    const usernameDisplay = document.getElementById("usernameDisplay");

const userDataString = localStorage.getItem("userData");
  if (userDataString) {
    try {
      const userDataObj = JSON.parse(userDataString);
            designeeFirstName = userDataObj.firstName || "";
          } catch (err) { console.error(err); }
  } 
  

  usernameDisplay.textContent = designeeFirstName;
  await loadUserRoleDisplay();
  await getCurrentUserData();
  loadRequirements();

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", e => {
    e.preventDefault();
    ["userData","studentName","schoolID","studentID","staffID","designeeID","category","office","department"]
      .forEach(key => localStorage.removeItem(key));
    window.location.href = "../../logout.html";
  });

  // Add requirement
  document.getElementById("addRequirementBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newRequirementInput");
    const text = input.value.trim();
    if (!text) return alert("Enter a requirement.");
    addRequirement(text);
    input.value = "";
  });

  // Edit modal
  document.getElementById("saveEditBtn")?.addEventListener("click", () => {
    const text = document.getElementById("editRequirementInput").value.trim();
    if (!text) return alert("Cannot be empty.");
    saveEditedRequirement(text);
  });
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => closeModal(document.getElementById("editModal")));

  // Delete modal
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", () => deleteRequirement());
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => closeModal(document.getElementById("deleteModal")));
});
