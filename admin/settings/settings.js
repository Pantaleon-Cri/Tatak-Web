document.addEventListener("DOMContentLoaded", function () {
  // 🔁 Modal handling
  const openBtn = document.getElementById('openModalBtn');
  const modal = document.getElementById('modalOverlay');
  const cancelBtn = document.getElementById('cancelBtn');

  if (openBtn && modal && cancelBtn) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  } else {
    console.warn('Modal elements not found');
  }

  // 🔁 Logout handling
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();

      const keysToRemove = [
        "userData",
        "studentName",
        "schoolID",
        "studentID",
        "staffID",
        "designeeID",
        "category",
        "office",
        "department"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../logout.html";
    });
  } else {
    console.warn('logoutBtn not found in DOM');
  }
});
