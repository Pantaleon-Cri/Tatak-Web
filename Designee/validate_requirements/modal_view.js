// -------------------- Helper Functions --------------------

// Normalize strings for comparison
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Fetch readable category/club name from ID
async function getCategoryName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;

  let doc = await db.collection("acadClubTable").doc(id).get();
  if (doc.exists) return doc.data().club || doc.data().clubName || doc.data().name || id;

  doc = await db.collection("groupTable").doc(id).get();
  if (doc.exists) return doc.data().club || doc.data().clubName || doc.data().name || id;

  return id;
}

// Fetch lab name from ID
async function getLabName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("labTable").doc(id).get();
    return doc.exists ? doc.data().lab || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching lab name:", err);
    return id;
  }
}

// Fetch office name from ID
async function getOfficeName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("officeTable").doc(id).get();
    return doc.exists ? doc.data().office || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching office name:", err);
    return id;
  }
}

// Fetch department name from ID
async function getDepartmentName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("departmentTable").doc(id).get();
    return doc.exists ? doc.data().department || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching department name:", err);
    return id;
  }
}

// -------------------- Modal Handling --------------------
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("clearanceModal");
  const closeBtn = document.getElementById("closeClearanceBtn");

  if (closeBtn) closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
});

// -------------------- Main Clearance Loader --------------------
window.openViewClearanceCard = async function(studentID, db) {
  const modal = document.getElementById("clearanceModal");
  modal.style.display = "block";

  document.getElementById("studentId").textContent = studentID;
  document.getElementById("studentName").textContent = "Loading...";
  document.getElementById("status").textContent = "Loading...";
  document.getElementById("semesterText").textContent = "";
  document.getElementById("officeSectionsGrid").innerHTML = "<p>Loading offices...</p>";
  document.getElementById("nonAcademicSectionsGrid").innerHTML = "";

  try {
    // ================= Fetch student =================
    const studentDoc = await db.collection("Students").doc(studentID).get();
    if (!studentDoc.exists) {
      document.getElementById("studentName").textContent = "Student not found";
      return;
    }
    const student = studentDoc.data();
    document.getElementById("studentName").textContent =
      [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");

    // Convert student clubs to readable names
    const studentClubsIds = Array.isArray(student.clubs) ? student.clubs.map(String) :
                            typeof student.clubs === "string" ? student.clubs.split(",").map(c => c.trim()) : [];
    const studentClubs = [];
    for (const cId of studentClubsIds) {
      const cName = await getCategoryName(db, cId);
      if (cName) studentClubs.push(cName);
    }

    const studentDept = String(student.department || "").trim();
    const studentSemesterId = String(student.semester || "").trim();

    // 🔹 Get readable semester name
    let studentSemesterName = "";
    const semesterSnap = await db.collection("semesterTable").doc(studentSemesterId).get();
    if (semesterSnap.exists) studentSemesterName = String(semesterSnap.data().semester || "").trim();
    document.getElementById("semesterText").textContent = studentSemesterName || "Unknown Semester";

    // ================= Allowed collections =================
    const allowedSnap = await db.collection("allowedCollections").get();
    const allowedCollections = allowedSnap.docs.map(doc => doc.data().name).filter(Boolean);

    const allowedMemberships = new Set();
    for (const collName of allowedCollections) {
      const doc = await db.collection(collName).doc(studentID).get().catch(()=>null);
      if (doc && doc.exists) {
        const name = await getCategoryName(db, collName);
        if (name) allowedMemberships.add(name);
      }
    }

    // ================= Fetch requirements =================
    const reqSnap = await db.collection("RequirementsTable").get();
    const groupedReqs = {};
    let anyRequirementsFound = false;

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();

      // 🔹 Filter by student semester
      if (String(req.semester || "").trim() !== studentSemesterName) continue;

      const reqDept = String(req.department || "").trim();
      const reqCategory = String(req.category || "").trim();
      const reqOffice = String(req.office || "").trim();
      const reqLab = String(req.lab || "").trim();
      const addedByDesigneeId = String(req.addedByDesigneeId || "").trim();

      const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
      const isCategoryGlobal = normalizeString(reqCategory) === "n/a" || reqCategory === "";

      let showRequirement = false;

      // ---------------- RULES ----------------
      if (["302","303","304","305","306"].includes(reqOffice)) {
        showRequirement = true;
      }
      else if (["401","403"].includes(reqCategory)) {
        showRequirement = true;
      }
      else if (reqOffice === "301") {
        if (["401","403"].includes(reqCategory)) {
          showRequirement = true;
        } else {
          const categoryName = await getCategoryName(db, reqCategory);
          if (allowedMemberships.has(categoryName)) showRequirement = true;
        }
      }
      else if (reqOffice === "309") {
        const categoryName = await getCategoryName(db, reqCategory);
        if (studentClubs.includes(categoryName)) showRequirement = true;
      }
      else if (["310","311","312","313"].includes(reqOffice)) {
        const groupSnap = await db.collection("groupTable").get();
        for (const doc of groupSnap.docs) {
          const collName = doc.data().club;
          if (!collName) continue;
          const studentInColl = await db.collection(collName).doc(studentID).get();
          if (studentInColl.exists) { showRequirement = true; break; }
        }
      }
      else if (reqOffice === "314") {
        const labSnap = await db.collection("labTable").get();
        for (const doc of labSnap.docs) {
          const collName = doc.data().lab;
          if (!collName) continue;
          const studentInLab = await db.collection(collName).doc(studentID).get();
          if (studentInLab.exists) { showRequirement = true; break; }
        }
      }
      else if (["307","308"].includes(reqOffice) && !isDeptGlobal && normalizeString(reqDept) === normalizeString(studentDept)) {
        showRequirement = true;
      }
      else if (isDeptGlobal && isCategoryGlobal) {
        showRequirement = true;
      }

      if (!showRequirement) continue;
      anyRequirementsFound = true;

      const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;
      if (!groupedReqs[key]) groupedReqs[key] = { category: reqCategory, department: reqDept, office: reqOffice, lab: reqLab, requirements: [], addedByDesigneeId };
      groupedReqs[key].requirements.push(req.requirement);
    }

    // ================= Validation data =================
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentID).get();
    const officesData = valDoc?.exists ? valDoc.data().offices || {} : {};

    // ================= Render =================
    let overallCleared = true;
    const containerEl = document.getElementById("officeSectionsGrid");
    containerEl.innerHTML = "";

    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];
      const isDeptGlobal = normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal = normalizeString(group.category) === "n/a" || group.category === "";

      let headerTitle = "";

      if (group.office === "314" && !isCategoryGlobal) {
        headerTitle = (await getLabName(db, group.category)) || group.category;
      } else if (!isCategoryGlobal) {
        headerTitle = (await getCategoryName(db, group.category)) || group.category;
      } else if (isCategoryGlobal && isDeptGlobal) {
        headerTitle = (await getOfficeName(db, group.office)) || group.office;
      } else if (isCategoryGlobal && !isDeptGlobal) {
        const officeName = (await getOfficeName(db, group.office)) || group.office;
        const deptName = (await getDepartmentName(db, group.department)) || group.department;
        headerTitle = `${officeName} - ${deptName}`;
      }

      if (group.lab) {
        const labName = await getLabName(db, group.lab);
        if (labName) headerTitle += ` - ${labName}`;
      }

      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = headerTitle;
      sectionGroupDiv.appendChild(headerLabel);

      const validatedArray = officesData[group.addedByDesigneeId] || [];
      const allChecked = validatedArray.length > 0 && validatedArray.every(item => item.status === true);
      if (!allChecked) overallCleared = false;
      const lastCheckedBy = validatedArray.filter(item => item.status === true && item.checkedBy).map(item => item.checkedBy).pop() || null;

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");
      approvalDiv.innerHTML = allChecked
        ? `<img src="../../Tatak.png" alt="Approved Icon" style="width:50px; height:50px;" /><br />
           <label style="font-size:14px; color:#333;"><i>approved by ${lastCheckedBy || "Unknown"}</i><hr /></label>`
        : `<label><i>Not Cleared</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      containerEl.appendChild(sectionGroupDiv);
    }

    document.getElementById("status").innerHTML = overallCleared
      ? `<span style="color:green">Completed</span>`
      : `<span style="color:red">Pending</span>`;

    if (!anyRequirementsFound) {
      containerEl.innerHTML = `<div class="section-item"><label class="section-header">No Requirements Found</label><p>You currently have no active requirements.</p></div>`;
      document.getElementById("status").innerHTML = `<span style="color:red">Pending</span>`;
    }

  } catch (err) {
    console.error("Error loading clearance:", err);
    document.getElementById("officeSectionsGrid").innerHTML = "<p>Failed to load clearance.</p>";
    document.getElementById("status").innerHTML = `<span style="color:red">Pending</span>`;
  }
};
