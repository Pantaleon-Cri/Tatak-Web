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

// DOM elements
const semester = document.querySelector("#semesterTable tbody");
const department = document.querySelector("#departmentTable tbody");
const course = document.querySelector("#courseTable tbody");
const year = document.querySelector("#yearTable tbody");
const office = document.querySelector("#officeTable tbody");
const clubs = document.querySelector("#clubsTable tbody");
const lab = document.querySelector("#labTable tbody");
const group = document.querySelector("#groupTable tbody");

window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");
  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (event) => {
    if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.style.display = "none";
    }
  });

  // Load all tables
  loadSemester();
  loadDepartment();
  loadCourse();
  loadYear();
  loadOffice();
  loadLab();
  loadClubs();
  loadGroup();
});

// 🔹 SEMESTER
async function loadSemester() {
  try {
    semester.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Semester").collection("SemesterDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      semester.innerHTML += `<tr><td>${doc.id}</td><td>${data.semester}</td></tr>`;
    });
  } catch (error) {
    console.error("Error loading semesters:", error);
  }
}

// 🔹 DEPARTMENT
async function loadDepartment() {
  try {
    department.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Department").collection("DepartmentDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      department.innerHTML += `<tr><td>${doc.id}</td><td>${data.code}</td><td>${data.department}</td></tr>`;
    });
  } catch (error) {
    console.error("Error loading department:", error);
  }
}

// 🔹 COURSE
async function loadCourse() {
  try {
    course.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Course").collection("CourseDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert clubCodeName array properly
      const clubsDisplay = Array.isArray(data.clubCodeName) ? data.clubCodeName.join(", ") : data.clubCodeName;
      course.innerHTML += `
        <tr>
          <td>${doc.id}</td>
          <td>${data.course}</td>
         
        </tr>`;
    });
  } catch (error) {
    console.error("Error loading course:", error);
  }
}

// 🔹 YEAR LEVEL
async function loadYear() {
  try {
    year.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("YearLevel").collection("YearLevelDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      year.innerHTML += `<tr><td>${doc.id}</td><td>${data.yearLevel}</td></tr>`;
    });
  } catch (error) {
    console.error("Error loading year level:", error);
  }
}

// 🔹 OFFICE
async function loadOffice() {
  try {
    office.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Office").collection("OfficeDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      office.innerHTML += `<tr><td>${doc.id}</td><td>${data.office}</td></tr>`;
    });
  } catch (error) {
    console.error("Error loading office:", error);
  }
}

// 🔹 LAB
async function loadLab() {
  try {
    lab.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Lab").collection("LabDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      lab.innerHTML += `<tr><td>${doc.id}</td><td>${data.lab}</td></tr>`;
    });
  } catch (error) {
    console.error("Error loading lab:", error);
  }
}

// 🔹 CLUBS
async function loadClubs() {
  try {
    clubs.innerHTML = "";
    const snapshot = await db.collection("DataTable").doc("Clubs").collection("ClubsDocs").limit(3).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      clubs.innerHTML += `
        <tr>
          <td>${doc.id}</td>
          <td>${data.code}</td>
          <td>${data.club}</td>
 
        </tr>`;
    });
  } catch (error) {
    console.error("Error loading clubs:", error);
  }
}



// 🔹 LOGOUT
window.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ["userData", "studentName", "schoolID", "studentID", "staffID", "designeeID", "category", "office", "department"]
        .forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }
});

// 🔹 SIDEBAR
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      const submenu = this.parentElement.querySelector('.submenu');
      submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
      this.querySelector('.arrow')?.classList.toggle('rotated');
    });
  });
}
document.addEventListener('DOMContentLoaded', initSidebarDropdowns);
