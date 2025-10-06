// ========================== Firebase v8 config + init ==========================
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

// ========================== User Dropdown Toggle ==========================
const toggle = document.getElementById('userDropdownToggle');
const menu = document.getElementById('dropdownMenu');

if (toggle && menu) {
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

// ========================== Sidebar Dropdown Toggle ==========================
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    const parentLi = this.parentElement;
    parentLi.classList.toggle('open');
  });
});

// ========================== Get Current Semester ==========================
async function getCurrentSemester() {
  try {
    const semesterSnapshot = await db
      .collection("/DataTable/Semester/SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (!semesterSnapshot.empty) {
      const semesterData = semesterSnapshot.docs[0].data();
      return { id: semesterSnapshot.docs[0].id, name: semesterData.semester || null };
    }
  } catch (error) {
    console.error("Error fetching current semester:", error);
  }
  return null;
}

// ========================== Load Students ==========================
async function loadStudents() {
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  try {
    const CURRENT_SEMESTER = await getCurrentSemester();
    if (!CURRENT_SEMESTER) {
      tbody.innerHTML = "<tr><td colspan='4'>No active semester found</td></tr>";
      return;
    }

    // Fetch all students
    const studentsSnapshot = await db.collection("/User/Students/StudentsDocs").get();
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch all designees
    const designeeSnapshot = await db.collection("/User/Designees/DesigneesDocs").get();
    const designees = designeeSnapshot.docs.map(doc => ({ id: doc.id }));

    tbody.innerHTML = ""; // clear loader

    for (const student of students) {
      const studentID = student.schoolId;
      const firstName = student.firstName || "";
      const lastName = student.lastName || "";

      let status = "No History Found";
      let hasRequirements = false;

      // Loop through all designees to check validation
      for (const designee of designees) {
        const semesterDoc = await db
          .collection("Validation")
          .doc(designee.id)
          .collection(studentID)
          .doc(CURRENT_SEMESTER.id)
          .get();

        if (!semesterDoc.exists) continue;

        const requirements = semesterDoc.data().requirements || [];
        if (requirements.length === 0) continue;

        hasRequirements = true;

        // If any requirement is false, mark Pending immediately
        const anyPending = requirements.some(r => r.status === false);
        if (anyPending) {
          status = "Pending";
          break; // No need to check other designees
        }
      }

      // If all requirements checked and none are false
      if (hasRequirements && status !== "Pending") {
        status = "Completed";
      }

      // Append row
      const row = `
        <tr>
          <td>${studentID}</td>
          <td>${firstName}</td>
          <td>${lastName}</td>
          <td>${status}</td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    }
  } catch (error) {
    console.error("Error loading students:", error);
    tbody.innerHTML = "<tr><td colspan='4'>Error loading data</td></tr>";
  }
}

// ========================== Export Table to Excel (CSV) ==========================
function downloadTableAsExcel() {
  const table = document.getElementById("studentsTable");
  const rows = Array.from(table.querySelectorAll("tr"));
  const csvContent = rows.map(row => {
    const cols = Array.from(row.querySelectorAll("th, td"));
    return cols.map(col => `"${col.innerText}"`).join(",");
  }).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "students_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ========================== DOMContentLoaded ==========================
document.addEventListener("DOMContentLoaded", () => {
  loadStudents();

  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  // Logout button
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
      window.location.href = "../../logout.html";
    });
  }

  // Download button
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadTableAsExcel);
  }
});
