// ✅ activityLogs.js

// ----------------------
// Firestore Initialization
// ----------------------
// (Assumes firebase and db are already initialized globally in another file)


// ----------------------
// Cache for lookups
// ----------------------
const nameCache = {
  office: {},
  department: {},
  acadClub: {}
};

// ----------------------
// Preload reference names
// ----------------------
async function preloadNames() {
  // 🔹 Office Table
  const officeSnap = await db.collection("/DataTable/Office/OfficeDocs").get();
  officeSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id && data.office) {
      nameCache.office[doc.id] = data.office;
    }
  });

  // 🔹 Department Table
  const deptSnap = await db.collection("/DataTable/Department/DepartmentDocs").get();
  deptSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id && data.department) {
      nameCache.department[doc.id] = data.department;
    }
  });

  // 🔹 Clubs Table (Acad Clubs + Groups merged)
  const acadSnap = await db.collection("/DataTable/Clubs/ClubsDocs").get();
  acadSnap.forEach(doc => {
    const data = doc.data();
    if (data.codeName) {
      nameCache.acadClub[data.codeName] = data.codeName;
    } else if (data.club) {
      nameCache.acadClub[doc.id] = data.club;
    }
  });
}

// ----------------------
// Helper: Resolve readable name
// ----------------------
function getReadableName({ office, department, category }) {
  if (category && nameCache.acadClub[category]) {
    return nameCache.acadClub[category];
  }
  if (office && nameCache.office[office]) {
    if (department && nameCache.department[department]) {
      return `${nameCache.office[office]} - ${nameCache.department[department]}`;
    }
    return nameCache.office[office];
  }
  return office || department || category || "Unknown";
}

// ----------------------
// Helper: Format timestamp
// ----------------------
function formatTimestamp(timestamp) {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "long",   // e.g. October
    day: "numeric",  // e.g. 6
    year: "numeric", // e.g. 2025
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true     // 12-hour format (AM/PM)
  });
}

// ----------------------
// Load logs (Dashboard preview → 10 only)
// ----------------------
async function loadStaffCreationLogs() {
  const logsContainer = document.querySelector(".logs-container .activity-log ul");
  if (!logsContainer) return; // not on dashboard

  logsContainer.innerHTML = "<li>Loading...</li>";

  try {
    await preloadNames();

    // 🔹 Updated StaffDocs path
    const staffSnapshot = await db
      .collection("/User/Designees/StaffDocs")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    logsContainer.innerHTML = "";

    for (const staffDoc of staffSnapshot.docs) {
      const staff = staffDoc.data();

      // 🔹 Fetch Designee info
      const designeeDoc = await db
        .collection("/User/Designees/DesigneesDocs")
        .doc(staff.createdByDesigneeID)
        .get();

      if (!designeeDoc.exists) continue;

      const designee = designeeDoc.data();
      const designeeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
      const staffName = `${staff.firstName} ${staff.lastName}`;
      const staffFor = getReadableName({
        office: staff.office,
        department: staff.department,
        category: staff.category
      });
      const formattedDate = formatTimestamp(staff.createdAt);

      const li = document.createElement("li");
      li.textContent = `${designeeName} created account for ${staffName} as Staff for ${staffFor} — ${formattedDate}`;
      logsContainer.appendChild(li);
    }
  } catch (err) {
    console.error("Error loading activity logs:", err);
    logsContainer.innerHTML = "<li>Error loading logs.</li>";
  }
}

// ----------------------
// Load ALL logs (Activity Log page → full table)
// ----------------------
async function loadFullActivityLogs() {
  const tbody = document.getElementById("fullActivityLog");
  if (!tbody) return; // not on activitylog.html

  tbody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

  try {
    await preloadNames();

    // 🔹 Get current semester
    const semSnap = await db
      .collection("/DataTable/Semester/SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    const currentSemester = semSnap.empty
      ? "UnknownSemester"
      : semSnap.docs[0].data().semester;

    // 🔹 Assign export button
    const exportBtn = document.getElementById("exportSheetBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const table = document.querySelector(".log-table");
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, { sheet: "Activity Log" });
        XLSX.writeFile(wb, `ActivityLog_${currentSemester}.xlsx`);
      });
    }

    // 🔹 Updated StaffDocs path
    const staffSnapshot = await db
      .collection("/User/Designees/StaffDocs")
      .orderBy("createdAt", "desc")
      .get();

    tbody.innerHTML = "";

    for (const staffDoc of staffSnapshot.docs) {
      const staff = staffDoc.data();

      // 🔹 Fetch Designee info
      const designeeDoc = await db
        .collection("/User/Designees/DesigneesDocs")
        .doc(staff.createdByDesigneeID)
        .get();

      if (!designeeDoc.exists) continue;

      const designee = designeeDoc.data();
      const designeeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
      const staffName = `${staff.firstName} ${staff.lastName}`;
      const staffFor = getReadableName({
        office: staff.office,
        department: staff.department,
        category: staff.category
      });
      const formattedDate = formatTimestamp(staff.createdAt);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${designeeName}</td>
        <td>Created Staff Account</td>
        <td>${staffName}</td>
        <td>${staffFor}</td>
        <td>${formattedDate}</td>
      `;
      tbody.appendChild(row);
    }
  } catch (err) {
    console.error("Error loading full activity logs:", err);
    tbody.innerHTML = "<tr><td colspan='5'>Error loading logs.</td></tr>";
  }
}

// ----------------------
// DOMContentLoaded → Run on both pages
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID; // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }

  // Run log loaders
  loadStaffCreationLogs(); // dashboard preview
  loadFullActivityLogs();  // full activity log page
});
