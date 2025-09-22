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

// ✅ Sidebar dropdown toggle
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    const parentLi = this.parentElement;
    parentLi.classList.toggle('open');
  });
});

async function getCurrentSemester() {
  try {
    const semesterSnapshot = await db.collection("semesterTable")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (!semesterSnapshot.empty) {
      const semesterData = semesterSnapshot.docs[0].data();
      return semesterData.semester || null;
    }
  } catch (error) {
    console.error("Error fetching current semester:", error);
  }
  return null;
}

async function loadStudents() {
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  try {
    // ✅ First, get the current semester
    const CURRENT_SEMESTER = await getCurrentSemester();
    if (!CURRENT_SEMESTER) {
      tbody.innerHTML = "<tr><td colspan='4'>No active semester found</td></tr>";
      return;
    }

    // Fetch all students
    const studentsSnapshot = await db.collection("Students").get();

    tbody.innerHTML = ""; // clear loader

    for (const doc of studentsSnapshot.docs) {
      const student = doc.data();
      const schoolId = student.schoolId;
      const firstName = student.firstName || "";
      const lastName = student.lastName || "";

      // Default status
      let status = "No History Found";

      // Check History collection
      const historyDoc = await db.collection("History").doc(schoolId).get();
      if (historyDoc.exists) {
        const historyData = historyDoc.data();
        if (
          historyData.semesters &&
          historyData.semesters[CURRENT_SEMESTER] &&
          historyData.semesters[CURRENT_SEMESTER].overallStatus
        ) {
          status = historyData.semesters[CURRENT_SEMESTER].overallStatus;
        }
      }

      // Append row
      const row = `
        <tr>
          <td>${schoolId}</td>
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

// ✅ Export table to Excel (CSV)
function downloadTableAsExcel() {
  const table = document.getElementById("studentsTable");
  const rows = Array.from(table.querySelectorAll("tr"));
  const csvContent = rows.map(row => {
    const cols = Array.from(row.querySelectorAll("th, td"));
    return cols.map(col => `"${col.innerText}"`).join(",");
  }).join("\n");

  // Create a blob and link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "students_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ✅ Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadStudents();

  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID; // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }

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
        "department",
        "adminID"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../logout.html";
    });
  }

  // ✅ Download button
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadTableAsExcel);
  }
});
