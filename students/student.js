// 🔥 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

// ✅ Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 🔍 Get human-readable category/club name
async function getCategoryName(categoryId) {
  if (!categoryId || categoryId.toLowerCase() === "n/a") return null;

  let docSnap = await db.collection("acadClubTable").doc(categoryId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.club || data.clubName || data.name || categoryId;
  }

  docSnap = await db.collection("groupTable").doc(categoryId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.club || data.clubName || data.name || categoryId;
  }

  return categoryId;
}

// 🔍 Get human-readable office name
async function getOfficeName(officeId) {
  if (!officeId) return null;

  let docSnap = await db.collection("officeTable").doc(officeId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.office || data.name || officeId;
  }

  return officeId;
}

// 🔍 Get human-readable department name
async function getDepartmentName(deptId) {
  if (!deptId) return null;

  let docSnap = await db.collection("departmentTable").doc(deptId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.department || data.name || deptId;
  }

  return deptId;
}

// 🔍 Get human-readable lab name
async function getLabName(labId) {
  if (!labId) return null;

  const docSnap = await db.collection("labTable").doc(labId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.lab || data.name || labId;
  }

  return labId;
}

// Utility: Normalize strings for safe matching (trim & lowercase)
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// ✅ DOM Ready
document.addEventListener("DOMContentLoaded", async () => {
  // Dropdown toggle logic
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
      }
    });
  }

  // Logout button logic
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html";
    });
  }

  // Load Student Requirements
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  try {
    // Fetch student document
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");

    const student = studentDoc.data();

    // Normalize clubs into array
    const studentClubs =
      typeof student.clubs === "string"
        ? student.clubs.split(",").map(c => c.trim())
        : Array.isArray(student.clubs)
          ? student.clubs.map(c => String(c).trim())
          : [];

    const studentDept = String(student.department || "").trim();

    const requirementsContainer = document.querySelector(".student-main-content");
    requirementsContainer.innerHTML = "";

    let anyRequirementsFound = false;

    // Fetch ALL requirements
    const reqSnap = await db.collection("RequirementsTable").get();

    // Prepare grouped requirements map
    // Prepare grouped requirements map
const groupedReqs = {};

for (const reqDoc of reqSnap.docs) {
  const req = reqDoc.data();

  const reqDept = String(req.department || "").trim();
  const reqCategory = String(req.category || "").trim();
  const reqOffice = String(req.office || "").trim();
  const reqLab = String(req.lab || "").trim(); // optional lab field

  const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
  const isCategoryGlobal = normalizeString(reqCategory) === "n/a" || reqCategory === "";

  let showRequirement = false;

  if (reqOffice === "309") {
    // Club requirements → student must have the club
    if (!isCategoryGlobal && studentClubs.includes(reqCategory)) {
      showRequirement = true;
    }
  } 
  else if (reqOffice === "314") {
    // Only show if student exists in the uploaded collection (category collection)
    if (!isCategoryGlobal && reqCategory) {
      try {
        const categoryDoc = await db.collection(reqCategory).doc(studentId).get();
        if (categoryDoc.exists) {
          showRequirement = true;
        }
      } catch (err) {
        console.error(`Failed to check category collection ${reqCategory}:`, err);
      }
    }
  }
  else if (isDeptGlobal && reqOffice !== "309") {
    // Global requirements for all students
    showRequirement = true;
  } 
  else if (normalizeString(reqDept) === normalizeString(studentDept)) {
    // Department-specific requirement
    showRequirement = true;
  }

  if (!showRequirement) continue;

  anyRequirementsFound = true;

  // Group key: category||department||office||lab
  const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;

  if (!groupedReqs[key]) {
    groupedReqs[key] = {
      category: reqCategory,
      department: reqDept,
      office: reqOffice,
      lab: reqLab,
      requirements: []
    };
  }
  groupedReqs[key].requirements.push(req.requirement);
}


    // Fetch ValidateRequirementsTable document for this student (with nested checked status)
    const validationDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const validationData = validationDoc.exists ? validationDoc.data() : {};

    // Fetch all notes once as well, grouped by category + department + office + lab
    const notesSnap = await db.collection("notesTable").get();
    const notesMap = {};
    notesSnap.forEach(doc => {
      const data = doc.data();

      const noteOffice = normalizeString(data.office);
      const noteCategory = normalizeString(data.category);
      const noteDepartment = normalizeString(data.department);
      const noteLab = normalizeString(data.lab);

      const key = `${noteCategory}||${noteDepartment}||${noteOffice}||${noteLab}`;
      if (!notesMap[key]) notesMap[key] = [];
      if (data.note) notesMap[key].push(data.note);
    });

    // Render grouped cards
    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];

      // Determine readable name for header
      let headerTitle = "";

      const isDeptGlobal = normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal = normalizeString(group.category) === "n/a" || group.category === "";

      // Step 1: Try category/club name
if (!isCategoryGlobal) {
    headerTitle = await getCategoryName(group.category) || group.category;
    // Step 2: If still numeric/raw ID, check labTable
    if (/^\d+$/.test(headerTitle)) { // simple numeric check
        const labName = await getLabName(group.category);
        if (labName) headerTitle = labName;
    }
} else if (isCategoryGlobal && isDeptGlobal) {
    headerTitle = await getOfficeName(group.office) || group.office;
} else if (isCategoryGlobal && !isDeptGlobal) {
    const officeName = await getOfficeName(group.office) || group.office;
    const deptName = await getDepartmentName(group.department) || group.department;
    headerTitle = `${officeName} - ${deptName}`;
}

// Append lab name if lab field exists
if (group.lab) {
    const labName = await getLabName(group.lab);
    if (labName) headerTitle += ` - ${labName}`;
}

      // Create requirement card container
      const requirementSection = document.createElement("div");
      requirementSection.className = "clearance-section-card";

      // Build inner HTML of requirements list
      let reqListHTML = "<ul class='requirements-list'>";
      for (const reqText of group.requirements) {
        const safeId = reqText.replace(/\s+/g, "-").toLowerCase();

        let isChecked = false;

        if (validationData.offices && typeof validationData.offices === "object") {
          for (const officeKey in validationData.offices) {
            const checkedArray = validationData.offices[officeKey];
            if (Array.isArray(checkedArray)) {
              for (const item of checkedArray) {
                if (
                  normalizeString(item.requirement) === normalizeString(reqText) &&
                  item.status === true
                ) {
                  isChecked = true;
                  break;
                }
              }
            }
            if (isChecked) break;
          }
        }

        reqListHTML += `
          <li class="requirement-item">
            <input type="checkbox" id="${safeId}" ${isChecked ? "checked" : ""} onclick="return false;">
            <label for="${safeId}">${reqText}</label>
          </li>
        `;
      }
      reqListHTML += "</ul>";

      // Notes for this category with strict matching
      let notesHTML = `<p>Submit to ${headerTitle} Office</p>`;
      const notesKey = `${normalizeString(group.category)}||${normalizeString(group.department)}||${normalizeString(group.office)}||${normalizeString(group.lab)}`;
      if (notesMap[notesKey]) {
        notesHTML = "";
        notesMap[notesKey].forEach(note => {
          notesHTML += `<p>${note}</p>`;
        });
      }

      requirementSection.innerHTML = `
        <div class="section-header">${headerTitle}</div>
        ${reqListHTML}
        <div class="notes-section">
          <h4>Notes</h4>
          ${notesHTML}
        </div>
      `;
      requirementsContainer.appendChild(requirementSection);
    }

    // If no requirements found
    if (!anyRequirementsFound) {
      requirementsContainer.innerHTML = `
        <div class="clearance-section-card">
          <div class="section-header">No Requirements Found</div>
          <div class="notes-section">
            <p>You currently have no active requirements.</p>
          </div>
        </div>
      `;
    }

  } catch (err) {
    console.error("Error loading student requirements:", err);
    alert("Unable to load your requirements. Please try again later.");
  }
});
