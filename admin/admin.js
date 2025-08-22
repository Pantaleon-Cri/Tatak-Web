// ✅ Firebase v8 config + init
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


document.addEventListener('DOMContentLoaded', () => {
  // ✅ Logout button
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
  }
// ✅ Toggle submenu
function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';

  const chevron = document.getElementById('accountsChevron');
  if (chevron) {
    chevron.classList.toggle('rotated');
  }
}

  // ✅ User dropdown toggle
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    // ✅ Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  // ✅ Fetch dynamic counts from Firestore
  updateDashboardCounts();
});

// ✅ Sidebar dropdown toggle
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    const parentLi = this.parentElement;
    parentLi.classList.toggle('open');
  });
});

// ✅ Get counts and update dashboard
async function updateDashboardCounts() {
  try {
    const studentsSnap = await db.collection("Students").get();
    const designeeSnap = await db.collection("Designees").get();
    const staffSnap = await db.collection("staffTable").get();

    const studentCount = document.getElementById("studentCount");
    const designeeCount = document.getElementById("designeeCount");
    const staffCount = document.getElementById("staffCount");

    if (studentCount) studentCount.textContent = studentsSnap.size;
    if (designeeCount) designeeCount.textContent = designeeSnap.size;
    if (staffCount) staffCount.textContent = staffSnap.size;
  } catch (error) {
    console.error("Error fetching counts:", error);
  }
}
