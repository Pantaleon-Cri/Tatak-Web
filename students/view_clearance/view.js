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
    // ================= Fetch current semester =================
    let currentSemesterId = null;
    let currentSemesterName = "Unknown Semester";

    const semesterSnap = await db.collection("semesterTable")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (!semesterSnap.empty) {
      const semesterDoc = semesterSnap.docs[0];
      currentSemesterId = semesterDoc.id;
      currentSemesterName = semesterDoc.data().semester;
    }

    // ================= Fetch student =================
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");
    const student = studentDoc.data();

    const studentDept = String(student.department || "").trim();

    // ================= Fetch all requirements =================
    const reqSnap = await db.collection("RequirementsTable").get();
    const groupedReqs = {};
    let anyRequirementsFound = false;

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();

      // ------------------ Filter by current semester ------------------
      if (req.semester) {
        const reqSemester = String(req.semester || "");
        if (reqSemester !== currentSemesterId && reqSemester !== currentSemesterName) continue;
      }

      const reqDept = String(req.department || "").trim();
      const reqCategory = String(req.category || "").trim();
      const reqOffice = String(req.office || "").trim();
      const reqLab = String(req.lab || "").trim();
      const addedByDesigneeId = String(req.addedByDesigneeId || "").trim();

      const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
      const isCategoryGlobal = normalizeString(reqCategory) === "n/a" || reqCategory === "";

      let showRequirement = false;

      // ================= RULES =================
      if (["302", "303", "304", "305", "306", "315"].includes(reqOffice)) {
        showRequirement = true;
      }
      else if (["401", "403"].includes(reqCategory)) {
        showRequirement = true;
      }
      else if (reqOffice === "301" || reqOffice === "309" || ["310", "311", "312", "313"].includes(reqOffice)) {
        // For offices 301, 309, 310-313 → check Membership by category
        if (reqCategory) {
          try {
            const membershipDoc = await db
              .collection("Membership")
              .doc(reqCategory)
              .collection("Members")
              .doc(studentId)
              .get();
            if (membershipDoc.exists) showRequirement = true;
          } catch (err) {
            console.error(`Error checking Membership for office ${reqOffice}:`, err);
          }
        }
      }
      else if (reqCategory) {
        // Fallback: generic category-based membership
        try {
          const memberDoc = await db
            .collection("Membership")
            .doc(reqCategory)
            .collection("Members")
            .doc(studentId)
            .get();
          if (memberDoc.exists) showRequirement = true;
        } catch (err) {
          console.error(`Error checking Membership for category ${reqCategory}:`, err);
        }
      }
      else if (["307", "308"].includes(reqOffice) && !isDeptGlobal && normalizeString(reqDept) === normalizeString(studentDept)) {
        showRequirement = true;
      }
      else if (isDeptGlobal && isCategoryGlobal) {
        showRequirement = true;
      }
      // ================= END RULES =================

      if (!showRequirement) continue;
      anyRequirementsFound = true;

      const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;
      if (!groupedReqs[key]) {
        groupedReqs[key] = {
          category: reqCategory,
          department: reqDept,
          office: reqOffice,
          lab: reqLab,
          requirements: [],
          addedByDesigneeId
        };
      }
      groupedReqs[key].requirements.push(req.requirement);
    }

    // ================= Fetch validation data =================
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const officesData = valDoc?.exists ? valDoc.data().offices || {} : {};

    // ------------------ Filter validation by semester if present ------------------
    for (const officeId in officesData) {
      officesData[officeId] = officesData[officeId].filter(item => {
        if (!item.semester) return true; // include if no semester stored
        return item.semester === currentSemesterId || item.semester === currentSemesterName;
      });
    }

    let overallCleared = true;

    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];
      const isDeptGlobal = normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal = normalizeString(group.category) === "n/a" || group.category === "";

      let headerTitle = "";

      if (!isCategoryGlobal) {
        if (/^2\d{2}$/.test(group.category)) {
          headerTitle = (await getLabName(group.category)) || group.category;
        } else {
          headerTitle = (await getCategoryName(group.category)) || group.category;
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

      const validatedArray = officesData[group.addedByDesigneeId] || [];
      const allChecked = validatedArray.length > 0 && validatedArray.every(item => item.status === true);
      if (!allChecked) overallCleared = false;

      // Get lastCheckedBy and checkedAt from validation array
      const lastValidation = validatedArray
        .filter(item => item.status === true && item.checkedBy)
        .sort((a, b) => b.checkedAt - a.checkedAt) // most recent first
        .pop() || null;

      const lastCheckedBy = lastValidation?.checkedBy || null;
      const checkedAt = lastValidation?.checkedAt
        ? new Date(lastValidation.checkedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })
        : "Unknown";

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      approvalDiv.innerHTML = allChecked
        ? `<img src="../../Tatak.png" alt="Approved Icon" style="width:50px; height:50px;" /><br />
           <label>
             <i>Approved by: ${String(lastCheckedBy || "Unknown")}</i><br />
             <i>${checkedAt}</i>
             <hr />
           </label>`
        : `<label><i>Not Cleared</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      container.appendChild(sectionGroupDiv);
    }

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
