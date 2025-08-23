document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const container = document.getElementById("officeSectionsGrid");
  const statusElement = document.getElementById("status");
  if (!container) {
    console.error("Container for office sections grid not found!");
    return;
  }
  container.innerHTML = "";
  statusElement.textContent = "Loading...";

  try {
    // Fetch student
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");
    const student = studentDoc.data();

    const studentClubs =
      typeof student.clubs === "string"
        ? student.clubs.split(",").map(c => c.trim())
        : Array.isArray(student.clubs)
        ? student.clubs.map(c => String(c).trim())
        : [];
    const studentDept = String(student.department || "").trim();

    // Fetch allowed collections
    const allowedSnap = await db.collection("allowedCollections").get();
    const allowedCollections = allowedSnap.docs.map(doc => doc.data().name).filter(Boolean);

    // Check allowed collections for this student
    let matchedStudentData = null;
    for (const collName of allowedCollections) {
      try {
        const doc = await db.collection(collName).doc(studentId).get();
        if (doc.exists) {
          matchedStudentData = doc.data();
          break;
        }
      } catch (err) {
        console.error(`Error checking allowed collection ${collName}:`, err);
      }
    }

    const studentCategory = matchedStudentData ? String(matchedStudentData.sourceCategory || "").trim() : String(student.sourceCategory || "").trim();
    const studentOffice = matchedStudentData ? String(matchedStudentData.sourceOffice || "").trim() : String(student.sourceOffice || "").trim();
    const studentDepartment = matchedStudentData ? String(matchedStudentData.sourceDepartment || "").trim() : String(student.sourceDepartment || "").trim();

    // Fetch all requirements
    const reqSnap = await db.collection("RequirementsTable").get();
    const groupedReqs = {};
    let anyRequirementsFound = false;

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();
      const reqDept = String(req.department || "").trim();
      const reqCategory = String(req.category || "").trim();
      const reqOffice = String(req.office || "").trim();
      const reqLab = String(req.lab || "").trim();
      const addedByDesigneeId = String(req.addedByDesigneeId || "").trim();

      const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
      const isCategoryGlobal = normalizeString(reqCategory) === "n/a" || reqCategory === "";

      let showRequirement = false;

      // ================= RULES =================
      if (["302","303","304","305","306"].includes(reqOffice)) showRequirement = true;
      else if (["401","403"].includes(reqCategory)) showRequirement = true;
      else if (reqOffice === "309" && studentClubs.includes(reqCategory)) showRequirement = true;
      else if (["301","310","311","312","313"].includes(reqOffice)) {
        try {
          const groupSnap = await db.collection("groupTable").get();
          for (const doc of groupSnap.docs) {
            const collName = doc.data().club;
            if (!collName) continue;
            const studentInColl = await db.collection(collName).doc(studentId).get();
            if (studentInColl.exists) {
              showRequirement = true;
              break;
            }
          }
        } catch (err) {
          console.error(`Error checking groupTable for office ${reqOffice}:`, err);
        }
      }
      else if (reqOffice === "314") {
        try {
          const labSnap = await db.collection("labTable").get();
          for (const doc of labSnap.docs) {
            const collName = doc.data().lab;
            if (!collName) continue;
            const studentInLab = await db.collection(collName).doc(studentId).get();
            if (studentInLab.exists) {
              showRequirement = true;
              break;
            }
          }
        } catch (err) {
          console.error("Error checking labTable for office 314:", err);
        }
      }
      else if (["307","308"].includes(reqOffice) && !isDeptGlobal && normalizeString(reqDept) === normalizeString(studentDept)) showRequirement = true;
      else if (isDeptGlobal && isCategoryGlobal) showRequirement = true;

      if (!showRequirement) continue;
      anyRequirementsFound = true;

      const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;
      if (!groupedReqs[key]) groupedReqs[key] = { category: reqCategory, department: reqDept, office: reqOffice, lab: reqLab, requirements: [], addedByDesigneeId };
      groupedReqs[key].requirements.push(req.requirement);
    }

    // Fetch validation data for this student
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const officesData = valDoc?.exists ? valDoc.data().offices || {} : {};

    // Track overall clearance
    let overallCleared = true;

    // Render sections with approval/not cleared
    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];

      const isDeptGlobal = normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal = normalizeString(group.category) === "n/a" || group.category === "";

      let headerTitle = "";
      if (!isCategoryGlobal) {
        headerTitle = (await getCategoryName(group.category)) || group.category;
        if (/^\d+$/.test(headerTitle)) {
          const labName = await getLabName(group.category);
          if (labName) headerTitle = labName;
        }
      } else if (isCategoryGlobal && isDeptGlobal) {
        headerTitle = (await getOfficeName(group.office)) || group.office;
      } else if (isCategoryGlobal && !isDeptGlobal) {
        const officeName = (await getOfficeName(group.office)) || group.office;
        const deptName = (await getDepartmentName(group.department)) || group.department;
        headerTitle = `${officeName} - ${deptName}`;
      }

      if (group.lab) {
        const labName = await getLabName(group.lab);
        if (labName) headerTitle += ` - ${labName}`;
      }

      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = headerTitle;
      sectionGroupDiv.appendChild(headerLabel);

      // Fetch validation array using addedByDesigneeId
      const validatedArray = officesData[group.addedByDesigneeId] || [];
      const allChecked = validatedArray.length > 0 && validatedArray.every(item => item.status === true);
      if (!allChecked) overallCleared = false;

      const lastCheckedBy = validatedArray.filter(item => item.status === true && item.checkedBy).map(item => item.checkedBy).pop() || null;

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      if (allChecked) {
        approvalDiv.innerHTML = `
          <img src="../../Tatak.png" alt="Approved Icon" />
          <label><i>approved by ${lastCheckedBy || "Unknown"}</i></label>
        `;
      } else {
        approvalDiv.innerHTML = `<label><i>Not Cleared</i></label>`;
      }

      sectionGroupDiv.appendChild(approvalDiv);
      container.appendChild(sectionGroupDiv);
    }

    // Set overall status
    statusElement.innerHTML = overallCleared
      ? `<span style="color:green">Completed</span>`
      : `<span style="color:red">Pending</span>`;

    if (!anyRequirementsFound) {
      container.innerHTML = `<div class="section-item"><label class="section-header">No Requirements Found</label><p>You currently have no active requirements.</p></div>`;
      statusElement.innerHTML = `<span style="color:red">Pending</span>`;
    }

  } catch (err) {
    console.error("Error loading clearance sections:", err);
    container.innerHTML = `<div class="section-item"><label class="section-header">Error</label><p>Unable to load clearance sections. Please try again later.</p></div>`;
    statusElement.innerHTML = `<span style="color:red">Pending</span>`;
  }
});
