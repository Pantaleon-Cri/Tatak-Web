document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault(); // Prevent default link behavior

  // ✅ Remove all known login-related keys
  const keysToRemove = [
    "userData",        // Designee or staff object
    "studentName",     // Student full name
    "schoolID",        // Student ID
    "studentID",       // In case some pages use this key
    "staffID",         // If used for staff
    "designeeID",      // If used for designees
    "category",
    "office",
    "department"
  ];

  keysToRemove.forEach(key => localStorage.removeItem(key));

  // 🔁 Redirect to login/index.html (role selection)
  window.location.href = "../logout.html"; // ✅ relative to logout.html
});
