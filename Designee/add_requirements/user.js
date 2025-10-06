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
    // 🔹 Updated Designees path
    const designeeSnap = await db.collection("User")
      .doc("Designees")
      .collection("DesigneesDocs")
      .doc(currentUser.id)
      .get();

    let userData;

    if (designeeSnap.exists) {
      currentUser.role = "designee";
      userData = designeeSnap.data();
      createdByDesigneeID = currentUser.id;
    } else {
      // 🔹 Updated Staff path
      const staffQuery = await db.collection("User")
        .doc("Designees")
        .collection("StaffDocs")
        .where("id", "==", currentUser.id)
        .get();

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
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) return;

    // 🔹 Determine designee ID
    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;
    if (!designeeId) return;

    const emailDiv = document.getElementById("userRoleDisplay");

    // 🔹 Get designee document
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
    let category = data.category || "";
    let department = data.department || "";
    let office = data.office || "";

    // 🔹 Convert category code to readable name
    if (category) {
      const catDoc = await db.collection("DataTable")
        .doc("Clubs")
        .collection("ClubsDocs")
        .doc(category)
        .get();
      if (catDoc.exists) {
        category = catDoc.data().club || category;
      }
    }

    // 🔹 Convert department code to readable name
    if (department) {
      const deptDoc = await db.collection("DataTable")
        .doc("Department")
        .collection("DepartmentDocs")
        .doc(department)
        .get();
      if (deptDoc.exists) {
        department = deptDoc.data().code || department;
      }
    }

    // 🔹 Convert office code to readable name
    if (office) {
      const officeDoc = await db.collection("DataTable")
        .doc("Office")
        .collection("OfficeDocs")
        .doc(office)
        .get();
      if (officeDoc.exists) {
        office = officeDoc.data().office || office;
      }
    }

    // 🔹 Build display string
    let displayText = "";
    if (category) {
      displayText = category;
    } else if (department) {
      displayText = `${department} - ${office}`;
    } else if (office) {
      displayText = office;
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

