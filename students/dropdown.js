function displayFullName() {
  const usernameDisplay = document.getElementById("usernameDisplay");
  if (!usernameDisplay) return;

  const studentName = localStorage.getItem("studentName");
  if (!studentName) return;

  // Display full name
  usernameDisplay.textContent = studentName;
}

document.addEventListener("DOMContentLoaded", () => {
  displayFullName();
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
      }
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html";
    });
  }
});
