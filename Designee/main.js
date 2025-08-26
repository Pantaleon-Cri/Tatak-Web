// ✅ Entry point

document.addEventListener("DOMContentLoaded", async () => {
  async function loadUserRoleDisplay() {
  const userData = JSON.parse(localStorage.getItem("userData"));
  if (!userData) return;

  const userId = userData.id;
  const emailDiv = document.getElementById("userRoleDisplay");

  try {
    const userDoc = await db.collection("Designees").doc(userId).get();
    if (!userDoc.exists) return;

    const data = userDoc.data();
    let category = data.category || null;
    let department = data.department || null;
    let office = data.office || null;

    // Convert category to readable name
    if (category) {
      let catDoc = await db.collection("acadClubTable").doc(category).get();
      if (!catDoc.exists) catDoc = await db.collection("groupTable").doc(category).get();
      if (!catDoc.exists) catDoc = await db.collection("labTable").doc(category).get();
      category = catDoc.exists ? (catDoc.data().club || catDoc.data().group || catDoc.data().lab) : category;
    }

    // Convert department to readable
    if (department) {
      const deptDoc = await db.collection("departmentTable").doc(department).get();
      department = deptDoc.exists ? deptDoc.data().department : department;
    }

    // Convert office to readable
    if (office) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      office = officeDoc.exists ? officeDoc.data().office : office;
    }

    // Build display string
    let displayText = "";
    if (category) {
      displayText = category;
    } else if (department) {
      displayText = `${department} - ${office || ""}`;
    } else {
      displayText = office || "";
    }

    emailDiv.textContent = displayText;

  } catch (err) {
    console.error("Error loading user role:", err);
    emailDiv.textContent = "Designee";
  }
}

// Call the function after page loads

  loadUserRoleDisplay();


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

  setupAddStaffModal();
  await getDesigneeInfoAndLoadStaff(userData.id);
  
});
// ---------- Modal Controls ----------
function setupAddStaffModal() {
  const openBtn = document.getElementById("openModalBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const generateBtn = document.getElementById("generateBtn");

  // Open modal
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modalOverlay.style.display = "flex"; // flex centers it
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
      const pass = Math.random().toString(36).slice(-8); // random 8-char password
      document.getElementById("generatedPassword").value = pass;
    });
  }

  // Save staff
  if (saveBtn) {
    saveBtn.addEventListener("click", saveNewStaff); // 👈 your function from staff.js
  }
}

// Reset inputs when closing
function clearModalInputs() {
  document.getElementById("staffId").value = "";
  document.getElementById("firstName").value = "";
  document.getElementById("lastName").value = "";
  document.getElementById("institutionalEmail").value = "";
  document.getElementById("generatedPassword").value = "";
}

const usernameDisplay = document.getElementById("usernameDisplay");

let designeeFullName = ""; // initialize

const userDataString = localStorage.getItem("userData");
if (userDataString) {
  try {
    const userDataObj = JSON.parse(userDataString);
    const firstName = userDataObj.firstName || "";
    const lastName = userDataObj.lastName || "";
    
    // Combine first and last name with a space
    designeeFullName = `${firstName} ${lastName}`.trim();
  } catch (err) {
    console.error(err);
  }
}

usernameDisplay.textContent = designeeFullName;
