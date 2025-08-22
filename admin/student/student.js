// Initialize Firebase v8 (if not already initialized)
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.appspot.com",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ"
  });
}
const db = firebase.firestore();

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", async () => {
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  // Toggle dropdown on click
  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display = 
      dropdownMenu.style.display === "block" ? "none" : "block";
  });

  // Hide dropdown if clicked outside
  document.addEventListener("click", (event) => {
    if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.style.display = "none";
    }
  });
  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) return console.error("Table body not found");

  try {
    // Fetch all students
    const studentsSnap = await db.collection("Students").get();
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch lookup tables
    const [clubsSnap, coursesSnap, departmentsSnap, yearLevelsSnap] = await Promise.all([
      db.collection("acadClubTable").get(),
      db.collection("courseTable").get(),
      db.collection("departmentTable").get(),
      db.collection("yearLevelTable").get()
    ]);

    const clubsMap = {};
    clubsSnap.forEach(doc => {
      const data = doc.data();
      clubsMap[doc.id] = data.codeName || "";
    });

    const coursesMap = {};
    coursesSnap.forEach(doc => {
      const data = doc.data();
      coursesMap[doc.id] = data.course || "";
    });

    const departmentsMap = {};
    departmentsSnap.forEach(doc => {
      const data = doc.data();
      departmentsMap[doc.id] = data.department || "";
    });

    const yearLevelsMap = {};
    yearLevelsSnap.forEach(doc => {
      const data = doc.data();
      yearLevelsMap[doc.id] = data.yearLevel || "";
    });

    // Render students
    tbody.innerHTML = ""; // clear existing rows
    students.forEach(student => {
      const clubsNames = Array.isArray(student.clubs)
        ? student.clubs.map(id => clubsMap[id] || id).join(", ")
        : "";

      const courseName = coursesMap[student.course] || student.course || "";
      const deptName = departmentsMap[student.department] || student.department || "";
      const yearLevelName = yearLevelsMap[student.yearLevel] || student.yearLevel || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${student.schoolId || ""}</td>
        <td>${student.firstName || ""}</td>
        <td>${student.lastName || ""}</td>
        <td>${courseName}</td>
        <td>${yearLevelName}</td>
        <td>${deptName}</td>
        <td>${clubsNames}</td>
        <td>${student.institutionalEmail || ""}</td>
        <td>
          <button class="action-btn edit" data-id="${student.id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${student.id}"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading students:", error);
  }

  // Optional: handle modal and logout logic if needed
});
function initSidebarDropdowns() {
  // Get all dropdown toggles
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();

      const parentLi = this.parentElement; // <li class="has-submenu">
      const submenu = parentLi.querySelector('.submenu');

      // Toggle visibility of the submenu
      if (submenu.style.display === 'block') {
        submenu.style.display = 'none';
        this.querySelector('.arrow')?.classList.remove('rotated');
      } else {
        submenu.style.display = 'block';
        this.querySelector('.arrow')?.classList.add('rotated');
      }
    });
  });
}

// 🔥 Run function after DOM loads
document.addEventListener('DOMContentLoaded', initSidebarDropdowns);