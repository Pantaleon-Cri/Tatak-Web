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

// --- Helper: Sync a student's course/club/department ---
async function syncStudentCourseInfo(studentDocId, studentData, coursesMap, clubsMap, departmentsMap) {
  const updates = {};

  // Match course (could be string or already ID)
  let courseDoc = null;
  if (studentData.course) {
    if (coursesMap[studentData.course]) {
      courseDoc = coursesMap[studentData.course];
    } else {
      courseDoc = Object.values(coursesMap).find(c => c.course === studentData.course);
    }
  }

  if (courseDoc) {
    updates.course = courseDoc.id;

    // Clubs via courseDoc.clubCodeName
    if (courseDoc.clubCodeName) {
      const clubCodes = courseDoc.clubCodeName.split(",").map(c => c.trim());
      updates.clubs = Object.values(clubsMap)
        .filter(club => clubCodes.includes(club.codeName))
        .map(club => club.id);
    } else {
      updates.clubs = [];
    }

    // Department via courseDoc.deptCodeName (match by "code")
    if (courseDoc.deptCodeName) {
      const deptDoc = Object.values(departmentsMap)
        .find(d => d.code === courseDoc.deptCodeName);
      if (deptDoc) {
        updates.department = deptDoc.id;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.collection("/User/Students/StudentsDocs").doc(studentDocId).update(updates);
    console.log(`Synced student ${studentData.schoolId || studentDocId}`, updates);
  }
}

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", async () => {
  // --- Logout ---
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
  }

  // --- User display ---
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  // --- Dropdown menu ---
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");
  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display =
      dropdownMenu.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (event) => {
    if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.style.display = "none";
    }
  });

  // --- Student Table ---
  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) return console.error("Table body not found");

  try {
    // --- Fetch lookup tables ---
    const [clubsSnap, coursesSnap, departmentsSnap, yearLevelsSnap, studentsSnap] = await Promise.all([
      db.collection("/DataTable/Clubs/ClubsDocs").get(),
      db.collection("/DataTable/Course/CourseDocs").get(),
      db.collection("/DataTable/Department/DepartmentDocs").get(),
      db.collection("/DataTable/YearLevel/YearLevelDocs").get(),
      db.collection("/User/Students/StudentsDocs").get()
    ]);

    // Build lookup maps
    const clubsMap = {}, coursesMap = {}, departmentsMap = {}, yearLevelsMap = {};
    clubsSnap.forEach(doc => clubsMap[doc.id] = { id: doc.id, ...doc.data() });
    coursesSnap.forEach(doc => coursesMap[doc.id] = { id: doc.id, ...doc.data() });
    departmentsSnap.forEach(doc => departmentsMap[doc.id] = { id: doc.id, ...doc.data() });
    yearLevelsSnap.forEach(doc => yearLevelsMap[doc.id] = { id: doc.id, ...doc.data() });

    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // --- Render students ---
    tbody.innerHTML = "";
    students.forEach(student => {
      const courseName = student.course && coursesMap[student.course]
        ? coursesMap[student.course].course
        : student.course || "";

      const deptName = student.department && departmentsMap[student.department]
        ? departmentsMap[student.department].department
        : student.department || "";

      const yearLevelName = student.yearLevel && yearLevelsMap[student.yearLevel]
        ? yearLevelsMap[student.yearLevel].yearLevel
        : student.yearLevel || "";

      // Convert club IDs to readable codes
      const clubsNames = Array.isArray(student.clubs)
        ? student.clubs.map(id => clubsMap[id]?.code || id).join(", ")
        : "";

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
    let currentEditId = null, currentDeleteId = null;

    // --- Edit ---
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
    editCancelBtn.addEventListener("click", () => { editModal.style.display = "none"; });
    editSaveBtn.addEventListener("click", async () => {
      if (!currentEditId) return;
      const [firstName, ...rest] = editStudentName.value.trim().split(" ");
      const lastName = rest.join(" ");
      try {
        await db.collection("/User/Students/StudentsDocs").doc(currentEditId).update({
          firstName: firstName || "",
          lastName: lastName || ""
        });
        alert("Student updated successfully!");
        window.location.reload();
      } catch (err) {
        console.error("Error updating student:", err);
        alert("Failed to update student");
      }
    });

    // --- Delete ---
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".delete")) {
        currentDeleteId = e.target.closest(".delete").dataset.id;
        deleteModal.style.display = "flex";
      }
    });
    deleteCancelBtn.addEventListener("click", () => { deleteModal.style.display = "none"; });
    deleteConfirmBtn.addEventListener("click", async () => {
      if (!currentDeleteId) return;
      try {
        await db.collection("/User/Students/StudentsDocs").doc(currentDeleteId).delete();
        alert("Student deleted successfully!");
        window.location.reload();
      } catch (err) {
        console.error("Error deleting student:", err);
        alert("Failed to delete student");
      }
    });

    // --- Excel Upload Integration ---
    const updateBtn = document.getElementById("updateStudentInfoBtn");
    if (updateBtn) {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".xlsx,.xls";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      updateBtn.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          for (const row of rows) {
            const schoolId = row["Student ID"]?.toString().trim();
            if (!schoolId) continue;

            const updates = {};
            if (row["Course"]) updates.course = row["Course"].toString().trim();
            if (row["Year Level"]) updates.yearLevel = row["Year Level"].toString().trim();

            const snap = await db.collection("/User/Students/StudentsDocs")
              .where("schoolId", "==", schoolId)
              .limit(1)
              .get();

            if (!snap.empty) {
              const studentDoc = snap.docs[0];
              await db.collection("/User/Students/StudentsDocs").doc(studentDoc.id).update(updates);

              // --- Normalize course, clubs, department ---
              await syncStudentCourseInfo(
                studentDoc.id,
                { ...studentDoc.data(), ...updates },
                coursesMap,
                clubsMap,
                departmentsMap
              );
            }
          }

          alert("Student info updated and synced successfully from Excel!");
          window.location.reload();
        } catch (error) {
          console.error("Error processing Excel:", error);
          alert("Failed to process Excel file.");
        }
      });
    }
  } catch (error) {
    console.error("Error loading students:", error);
  }

  initSidebarDropdowns();
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
