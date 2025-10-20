// ✅ Entry point
document.addEventListener("DOMContentLoaded", async () => {

  // -----------------------
  // Display designee info
  async function loadUserRoleDisplay() {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) return;

    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;
    if (!designeeId) return;

    const emailDiv = document.getElementById("userRoleDisplay");

    // 🔹 Fetch designee document
    const userDoc = await db.collection("User")
      .doc("Designees")
      .collection("DesigneesDocs")
      .doc(designeeId)
      .get();

    if (!userDoc.exists) {
      emailDiv.textContent = "Designee";
      return;
    }

    const data = userDoc.data();
    const office = data.office || "";
    const category = data.category || "";
    const department = data.department || "";

    // ---------------------------------------------------
    // 🔹 Step 1: Get Office Name
    // ---------------------------------------------------
    let officeName = "";
    if (office) {
      const officeSnap = await db.collection("DataTable")
        .doc("Office")
        .collection("OfficeDocs")
        .doc(office)
        .get();

      if (officeSnap.exists) {
        officeName = officeSnap.data().office || office;
      }
    }

    // ---------------------------------------------------
    // 🔹 Step 2: Get Category Name (Office-based)
    // ---------------------------------------------------
    let categoryName = "";
    if (category) {
      let categoryRef;

      if (office === "8") {
        // ✅ LAB
        categoryRef = db.collection("DataTable")
          .doc("Lab")
          .collection("LabDocs")
          .doc(category);
        console.log("Fetching category from /DataTable/Lab/LabDocs/", category);
      } else if (office === "1") {
        // ✅ CLUBS
        categoryRef = db.collection("DataTable")
          .doc("Clubs")
          .collection("ClubsDocs")
          .doc(category);
      } else if (office === "5") {
        // ✅ NSTP
        categoryRef = db.collection("DataTable")
          .doc("NSTP")
          .collection("NSTPDocs")
          .doc(category);
      } else {
        // fallback
        categoryRef = db.collection("DataTable")
          .doc("Clubs")
          .collection("ClubsDocs")
          .doc(category);
      }

      const catSnap = await categoryRef.get();
      if (catSnap.exists) {
        const catData = catSnap.data();
        console.log("Category data fetched:", catData);

        categoryName =
          catData.lab || // ✅ For Labs
          catData.club ||
          catData.name ||
          catData.category ||
          catData.code ||
          category;
      } else {
        categoryName = category;
      }
    }

    // ---------------------------------------------------
    // 🔹 Step 3: Get Department Name
    // ---------------------------------------------------
    let departmentName = "";
    if (department) {
      const deptSnap = await db.collection("DataTable")
        .doc("Department")
        .collection("DepartmentDocs")
        .doc(department)
        .get();

      if (deptSnap.exists) {
        departmentName = deptSnap.data().code || department;
      }
    }

    // ---------------------------------------------------
    // 🔹 Step 4: Build Display Text (Office-first)
    // ---------------------------------------------------
    let displayText = "";

    if (office === "11") {
      // ✅ If office is 11 → show office name from OfficeDocs only
      displayText = officeName || "Program Coordinator";
    } else if (officeName && categoryName) {
      displayText = `${officeName} - ${categoryName}`;
    } else if (officeName && departmentName) {
      displayText = `${departmentName} - ${officeName}`;
    } else if (officeName) {
      displayText = officeName;
    } else if (categoryName) {
      displayText = categoryName;
    } else {
      displayText = "Designee";
    }

    emailDiv.textContent = displayText;

  } catch (err) {
    console.error("Error loading user role:", err);
    const emailDiv = document.getElementById("userRoleDisplay");
    if (emailDiv) emailDiv.textContent = "Designee";
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
