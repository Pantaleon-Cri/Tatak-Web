document.addEventListener("DOMContentLoaded", function () {
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

      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
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