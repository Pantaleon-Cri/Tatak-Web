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
        // ✅ Corrected capitalization: "Lab" not "lab"
        categoryRef = db.collection("DataTable")
          .doc("Lab")
          .collection("LabDocs")
          .doc(category);
        console.log("Fetching category from /DataTable/Lab/LabDocs/", category);
      } else if (office === "1") {
        categoryRef = db.collection("DataTable")
          .doc("Clubs")
          .collection("ClubsDocs")
          .doc(category);
      } else if (office === "5") {
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
          catData.lab || // ✅ Use "lab" field for Lab office
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

    if (officeName && categoryName) {
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




