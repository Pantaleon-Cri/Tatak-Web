// user.js
let currentUser = null;
let userOffice = '';
let userCategory = '';
let userDepartment = '';
let createdByDesigneeID = null;

async function getCurrentUserData() {
  currentUser = JSON.parse(localStorage.getItem('userData'));

  if (!currentUser || !currentUser.id) {
    window.location.href = "../../login/designee_login.html";
    throw new Error("User not logged in.");
  }

  try {
    const designeeSnap = await db.collection("Designees").doc(currentUser.id).get();
    let userData;

    if (designeeSnap.exists) {
      currentUser.role = "designee";
      userData = designeeSnap.data();
      createdByDesigneeID = currentUser.id;
    } else {
      const staffQuery = await db.collection("staffTable").where("id", "==", currentUser.id).get();
      if (staffQuery.empty) throw new Error("User not found");

      const staffDoc = staffQuery.docs[0];
      userData = staffDoc.data();
      currentUser.role = "staff";
      createdByDesigneeID = userData.createdByDesigneeID || null;
    }

    userOffice = (userData.office || "N/A").trim();
    userCategory = (userData.category || "N/A").trim();
    userDepartment = (userData.department || "N/A").trim();

    return true;
  } catch (err) {
    console.error("Failed to get user data:", err);
    alert("Failed to fetch user data.");
    throw err;
  }
}

async function loadUserRoleDisplay() {
  const userData = JSON.parse(localStorage.getItem("userData"));
  if (!userData) return;

  const emailDiv = document.getElementById("userRoleDisplay");
  let displayText = "Designee";

  try {
    const userDoc = await db.collection("Designees").doc(userData.id).get();
    if (!userDoc.exists) return;

    let { category, department, office } = userDoc.data();

    if (category) {
      let catDoc = await db.collection("acadClubTable").doc(category).get();
      if (!catDoc.exists) catDoc = await db.collection("groupTable").doc(category).get();
      if (!catDoc.exists) catDoc = await db.collection("labTable").doc(category).get();
      category = catDoc.exists ? (catDoc.data().club || catDoc.data().group || catDoc.data().lab) : category;
    }

    if (department) {
      const deptDoc = await db.collection("departmentTable").doc(department).get();
      department = deptDoc.exists ? deptDoc.data().department : department;
    }

    if (office) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      office = officeDoc.exists ? officeDoc.data().office : office;
    }

    if (category) displayText = category;
    else if (department) displayText = `${department} - ${office || ""}`;
    else displayText = office || "";

    emailDiv.textContent = displayText;

  } catch (err) {
    console.error(err);
    emailDiv.textContent = "Designee";
  }
}
