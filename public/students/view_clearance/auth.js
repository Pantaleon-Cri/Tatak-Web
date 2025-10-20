// auth.js
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }
});
