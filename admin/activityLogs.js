// ✅ activityLogs.js

// ----------------------
// Firestore Initialization
// ----------------------


// ----------------------sssss
// Cache for lookupss
// ----------------------
const nameCache = {
  office: {},
  department: {},
  acadClub: {},
  group: {}
};

// ----------------------
// Preload reference names
// ----------------------
async function preloadNames() {
  // officeTable
  const officeSnap = await db.collection("officeTable").get();
  officeSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id && data.office) {
      nameCache.office[doc.id] = data.office;
    }
  });

  // departmentTable
  const deptSnap = await db.collection("departmentTable").get();
  deptSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id && data.department) {
      nameCache.department[doc.id] = data.department;
    }
  });

  // acadClubTable → key = codeName
  const acadSnap = await db.collection("acadClubTable").get();
  acadSnap.forEach(doc => {
    const data = doc.data();
    if (data.codeName) {
      nameCache.acadClub[data.codeName] = data.codeName;
    }
  });

  // groupTable → key = doc.id, value = club
  const groupSnap = await db.collection("groupTable").get();
  groupSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id && data.club) {
      nameCache.group[doc.id] = data.club;
    }
  });
}

// ----------------------
// Helper: resolve readable name
// ----------------------
function getReadableName({ office, department, category }) {
  if (category && nameCache.acadClub[category]) {
    return nameCache.acadClub[category];
  }
  if (category && nameCache.group[category]) {
    return nameCache.group[category];
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
// Load logs (Dashboard preview → 10 only)
// ----------------------
async function loadStaffCreationLogs() {
  const logsContainer = document.querySelector(".logs-container .activity-log ul");
  if (!logsContainer) return; // not on dashboard

  logsContainer.innerHTML = "<li>Loading...</li>";

  try {
    await preloadNames();

    const staffSnapshot = await db.collection("staffTable")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    logsContainer.innerHTML = "";

    for (const staffDoc of staffSnapshot.docs) {
      const staff = staffDoc.data();
      const designeeDoc = await db.collection("Designees").doc(staff.createdByDesigneeID).get();
      if (!designeeDoc.exists) continue;

      const designee = designeeDoc.data();
      const designeeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
      const staffName = `${staff.firstName} ${staff.lastName}`;
      const staffFor = getReadableName({
        office: staff.office,
        department: staff.department,
        category: staff.category
      });

      const li = document.createElement("li");
      li.textContent = `${designeeName} created account for ${staffName} as Staff for ${staffFor}`;
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

    const staffSnapshot = await db.collection("staffTable")
      .orderBy("createdAt", "desc")
      .get();

    tbody.innerHTML = "";

    for (const staffDoc of staffSnapshot.docs) {
      const staff = staffDoc.data();
      const designeeDoc = await db.collection("Designees").doc(staff.createdByDesigneeID).get();
      if (!designeeDoc.exists) continue;

      const designee = designeeDoc.data();
      const designeeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
      const staffName = `${staff.firstName} ${staff.lastName}`;
      const staffFor = getReadableName({
        office: staff.office,
        department: staff.department,
        category: staff.category
      });

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${designeeName}</td>
        <td>Created Staff Account</td>
        <td>${staffName}</td>
        <td>${staffFor}</td>
        <td>${staff.createdAt ? new Date(staff.createdAt.toDate()).toLocaleString() : "-"}</td>
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
  loadStaffCreationLogs(); // dashboard preview
  loadFullActivityLogs();  // full activity log page
});
