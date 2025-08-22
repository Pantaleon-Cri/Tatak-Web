
// Firebase configuration (v8)
var firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.firebasestorage.app",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// DOM element
const semester = document.querySelector("#semesterTable tbody");
const department = document.querySelector("#departmentTable tbody");
const course = document.querySelector("#courseTable tbody");
const year = document.querySelector("#yearTable tbody");
const office = document.querySelector("#officeTable tbody");
const clubs = document.querySelector("#clubsTable tbody");
const lab = document.querySelector("#labTable tbody");
const group = document.querySelector("#groupTable tbody");


// Load first 3 semester entries
window.addEventListener("DOMContentLoaded", async () => {
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
  try {
    semester.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("semesterTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.id}</td>
        <td>${data.semester}</td>
      `;
      semester.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading semesters:", error);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    department.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("departmentTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.id}</td>
        <td>${data.code}</td>
        <td>${data.department}</td>
      `;
      department.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading department:", error);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    course.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("courseTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.id}</td>
        <td>${data.course}</td>
        <td>${data.deptCodeName}</td>
        <td>${data.clubCodeName}</td>
        <td>${data.laboratories}</td>
      `;
      course.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading course:", error);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    year.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("yearLevelTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.id}</td>
        <td>${data.yearLevel}</td>
      `;
      year.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading year:", error);
  }
});
window.addEventListener("DOMContentLoaded", async () => {
  try {
    office.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("officeTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.id}</td>
        <td>${data.office}</td>
      `;
      office.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading office:", error);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    course.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("labTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.id}</td>
        <td>${data.lab}</td>
      `;
      lab.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading lab:", error);
  }
});
window.addEventListener("DOMContentLoaded", async () => {
  try {
    clubs.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("acadClubTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.id}</td>
        <td>${data.codeName}</td>
        <td>${data.club}</td>
        <td>${data.deptCode}</td>
      `;
      clubs.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading club:", error);
  }
});
window.addEventListener("DOMContentLoaded", async () => {
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
  try {
    course.innerHTML = ""; // Clear previous rows

    const snapshot = await db.collection("groupTable")
      .orderBy(firebase.firestore.FieldPath.documentId()) // sort by document ID
      .limit(3) // get first 3 only
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.id}</td>
        <td>${data.codeName}</td>
        <td>${data.club}</td>
        
      `;
      group.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading group:", error);
  }
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