// ✅ Handles session + logout + dropdown
let currentUserRole = null;
let userOffice = '', userCategory = '', userDepartment = '';

function checkSession() {
  const userData = JSON.parse(localStorage.getItem("userData"));
  if (!userData || !userData.role || !userData.id) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/designee_login.html";
    return null;
  }

  const usernameDiv = document.getElementById("username");
  if (usernameDiv) usernameDiv.textContent = userData.id;

  currentUserRole = userData.role;
  return userData;
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    ["userData","studentName","schoolID","studentID","staffID","designeeID","category","office","department"]
      .forEach(key => localStorage.removeItem(key));
    window.location.href = "../../../logout.html";
  });
}

function setupDropdownToggle() {
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
}
