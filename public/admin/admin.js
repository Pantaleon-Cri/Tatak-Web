// ======================= 🔥 Firebase v8 Config + Init =======================
var firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ======================= ⚙️ DOM Ready =======================
document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  usernameDisplay.textContent = storedAdminID || "Unknown";

  // ✅ Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department", "adminID"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html";
    });
  }

  // ✅ User dropdown toggle (compatible with new CSS)
  const userToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (userToggle && dropdownMenu) {
    userToggle.addEventListener("click", (e) => {
      e.stopPropagation();

      // Toggle classes instead of inline display
      userToggle.classList.toggle("active");
      dropdownMenu.classList.toggle("show");
    });

    // ✅ Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!userToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
        userToggle.classList.remove("active");
        dropdownMenu.classList.remove("show");
      }
    });
  }

  // ✅ Sidebar dropdown toggle
  document.querySelectorAll(".dropdown-toggle").forEach(toggle => {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const parentLi = toggle.parentElement;
      parentLi.classList.toggle("open");
    });
  });

  // ✅ Load Firestore dashboard counts
  updateDashboardCounts();
});

// ======================= 📊 Firestore Dashboard Counts =======================
async function updateDashboardCounts() {
  const studentCount = document.getElementById("studentCount");
  const designeeCount = document.getElementById("designeeCount");
  const staffCount = document.getElementById("staffCount");

  try {
    const [studentsSnap, designeesSnap, staffSnap] = await Promise.all([
      db.collection("User/Students/StudentsDocs").get(),
      db.collection("User/Designees/DesigneesDocs").get(),
      db.collection("User/Designees/StaffDocs").get()
    ]);

    if (studentCount) studentCount.textContent = studentsSnap.size || 0;
    if (designeeCount) designeeCount.textContent = designeesSnap.size || 0;
    if (staffCount) staffCount.textContent = staffSnap.size || 0;
  } catch (error) {
    console.error("❌ Error fetching Firestore counts:", error);
    if (studentCount) studentCount.textContent = "-";
    if (designeeCount) designeeCount.textContent = "-";
    if (staffCount) staffCount.textContent = "-";
  }
}
