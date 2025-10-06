// ✅ Entry point
document.addEventListener("DOMContentLoaded", async () => {

  // -----------------------
  // Display designee info
  async function loadUserRoleDisplay() {
  const userData = JSON.parse(localStorage.getItem("userData"));
  if (!userData) return;

  const userId = userData.id;
  const emailDiv = document.getElementById("userRoleDisplay");

  try {
    // Get the user document
    const userDoc = await db.collection("User").doc("Designees")
      .collection("DesigneesDocs").doc(userId).get();

    if (!userDoc.exists) return;

    const data = userDoc.data();
    let category = data.category || "";
    let department = data.department || "";
    let office = data.office || "";

    // 1️⃣ Convert category code to readable club name
    if (category) {
      const catDoc = await db.collection("DataTable").doc("Clubs")
        .collection("ClubsDocs").doc(category).get();
      if (catDoc.exists) {
        category = catDoc.data().club || category;
      }
    }

    // 2️⃣ Convert department code to readable name
    if (department) {
      const deptDoc = await db.collection("DataTable").doc("Department")
        .collection("DepartmentDocs").doc(department).get();
      if (deptDoc.exists) {
        department = deptDoc.data().code || department;
      }
    }

    // 3️⃣ Convert office code to readable name
    if (office) {
      const officeDoc = await db.collection("DataTable").doc("Office")
        .collection("OfficeDocs").doc(office).get();
      if (officeDoc.exists) {
        office = officeDoc.data().office || office;
      }
    }

    // Build the display string
    let displayText = "";
    if (category) {
      displayText = category;
    } else if (department) {
      displayText = `${department} - ${office}`;
    } else {
      displayText = office;
    }

    emailDiv.textContent = displayText;

  } catch (err) {
    console.error("Error loading user role:", err);
    emailDiv.textContent = "Designee";
  }
}


  // Call display function
  await loadUserRoleDisplay();

  // -----------------------
  setupLogoutButton();
  setupDropdownToggle();

  const userData = checkSession();
  if (!userData) return;

  if (userData.role !== "designee") {
    document.getElementById("staffTableContainer").style.display = "none";
    document.getElementById("openModalBtn").style.display = "none";
    document.getElementById("notDesigneeMessage").style.display = "block";
    return;
  }

  // Setup add staff modal and load staff
  setupAddStaffModal();
  await getDesigneeInfoAndLoadStaff(userData.id);
  
});

// -----------------------
// Modal Controls
function setupAddStaffModal() {
  const openBtn = document.getElementById("openModalBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const generateBtn = document.getElementById("generateBtn");

  // Open modal
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modalOverlay.style.display = "flex";
    });
  }

  // Close modal
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modalOverlay.style.display = "none";
      clearModalInputs();
    });
  }

  // Generate password
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const pass = Math.random().toString(36).slice(-8);
      document.getElementById("generatedPassword").value = pass;
    });
  }

  // Save staff
  if (saveBtn) {
    saveBtn.addEventListener("click", window.saveNewStaff);
  }
}

// -----------------------
// Reset modal inputs
function clearModalInputs() {
  document.getElementById("staffId").value = "";
  document.getElementById("firstName").value = "";
  document.getElementById("lastName").value = "";
  document.getElementById("institutionalEmail").value = "";
  document.getElementById("generatedPassword").value = "";
}

// -----------------------
// Display designee full name
const usernameDisplay = document.getElementById("usernameDisplay");
let designeeFullName = "";

const userDataString = localStorage.getItem("userData");
if (userDataString) {
  try {
    const userDataObj = JSON.parse(userDataString);
    const firstName = userDataObj.firstName || "";
    const lastName = userDataObj.lastName || "";
    designeeFullName = `${firstName} ${lastName}`.trim();
  } catch (err) {
    console.error(err);
  }
}

usernameDisplay.textContent = designeeFullName;

// -----------------------
// Get designee info & load staff
async function getDesigneeInfoAndLoadStaff(userId) {
  const doc = await db.collection("User").doc("Designees")
    .collection("DesigneesDocs").doc(userId).get();
  
  if (!doc.exists) return;

  const d = doc.data();
  window.userOffice = d.office || "";
  window.userCategory = d.category || "";
  window.userDepartment = d.department || "";

  await loadAllStaff(); // load staff under StaffDocs
}
