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
        "department",
        "adminID"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;  // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }

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

    // --- Modal Elements ---
    const editModal = document.getElementById("editModalOverlay");
    const deleteModal = document.getElementById("deleteModalOverlay");

    const editStudentId = document.getElementById("editStudentId");
    const editStudentName = document.getElementById("editStudentName");
    const editCancelBtn = document.getElementById("editCancelBtn");
    const editSaveBtn = document.getElementById("editSaveBtn");

    const deleteCancelBtn = document.getElementById("deleteCancelBtn");
    const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

    let currentEditId = null;
    let currentDeleteId = null;

    // --- Edit Handlers ---
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".edit")) {
        const id = e.target.closest(".edit").dataset.id;
        const student = students.find(s => s.id === id);
        if (!student) return;

        currentEditId = id;
        editStudentId.value = student.schoolId || "";
        editStudentName.value = student.firstName + " " + student.lastName;

        editModal.style.display = "flex";
      }
    });

    editCancelBtn.addEventListener("click", () => {
      editModal.style.display = "none";
    });

    editSaveBtn.addEventListener("click", async () => {
      if (!currentEditId) return;
      const [firstName, ...rest] = editStudentName.value.trim().split(" ");
      const lastName = rest.join(" ");
      try {
        await db.collection("Students").doc(currentEditId).update({
          firstName: firstName || "",
          lastName: lastName || ""
        });
        alert("Student updated successfully!");
        window.location.reload(); // refresh list
      } catch (err) {
        console.error("Error updating student:", err);
        alert("Failed to update student");
      }
    });

    // --- Delete Handlers ---
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".delete")) {
        const id = e.target.closest(".delete").dataset.id;
        currentDeleteId = id;
        deleteModal.style.display = "flex";
      }
    });

    deleteCancelBtn.addEventListener("click", () => {
      deleteModal.style.display = "none";
    });

    deleteConfirmBtn.addEventListener("click", async () => {
      if (!currentDeleteId) return;
      try {
        await db.collection("Students").doc(currentDeleteId).delete();
        alert("Student deleted successfully!");
        window.location.reload();
      } catch (err) {
        console.error("Error deleting student:", err);
        alert("Failed to delete student");
      }
    });

  } catch (error) {
    console.error("Error loading students:", error);
  }
});

// Sidebar dropdowns
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      const parentLi = this.parentElement;
      const submenu = parentLi.querySelector('.submenu');
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
document.addEventListener('DOMContentLoaded', initSidebarDropdowns);
