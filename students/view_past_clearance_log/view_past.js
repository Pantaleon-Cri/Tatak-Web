function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';

  const chevron = document.getElementById('accountsChevron');
  chevron.classList.toggle('rotated');
}
document.addEventListener('DOMContentLoaded', () => {
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

      window.location.href = "../../logout.html"; // ✅ two levels up
    });
  } else {
    console.warn("logoutBtn not found");
  }
  const toggle = document.getElementById('userDropdownToggle');
const menu = document.getElementById('dropdownMenu');

toggle.addEventListener('click', () => {
  toggle.classList.toggle('active');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
});

  // Hide when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
});

document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    const parentLi = this.parentElement;
    parentLi.classList.toggle('open');
  });
});

