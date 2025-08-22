// clearance.js
document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const container = document.getElementById("officeSectionsGrid");
  if (!container) {
    console.error("Container for office sections grid not found!");
    return;
  }
  container.innerHTML = "";

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

    // Fetch requirements
    const reqSnap = await db.collection("RequirementsTable").get();
    const groupedReqs = {};

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();
      const reqDept = String(req.department || "").trim();
      const reqCategory = String(req.category || "").trim();
      const reqOffice = String(req.office || "").trim();
      const reqLab = String(req.lab || "").trim();

      const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
      const isCategoryGlobal =
        normalizeString(reqCategory) === "n/a" || reqCategory === "";

      let showRequirement = false;

      if (reqOffice === "309") {
        if (!isCategoryGlobal && studentClubs.includes(reqCategory))
          showRequirement = true;
      } else if (reqOffice === "314") {
        if (!isCategoryGlobal && reqCategory) {
          try {
            const categoryDoc = await db
              .collection(reqCategory)
              .doc(studentId)
              .get();
            if (categoryDoc.exists) showRequirement = true;
          } catch (err) {
            console.error(
              `Failed to check category collection ${reqCategory}:`,
              err
            );
          }
        }
      } else if (isDeptGlobal && reqOffice !== "309") {
        showRequirement = true;
      } else if (
        normalizeString(reqDept) === normalizeString(studentDept)
      ) {
        showRequirement = true;
      }

      if (!showRequirement) continue;

      const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;
      if (!groupedReqs[key]) {
        groupedReqs[key] = {
          category: reqCategory,
          department: reqDept,
          office: reqOffice,
          lab: reqLab,
          requirements: [],
        };
      }
      groupedReqs[key].requirements.push(req.requirement);
    }

    const validationDoc = await db
      .collection("ValidateRequirementsTable")
      .doc(studentId)
      .get();
    const validationData = validationDoc.exists ? validationDoc.data() : {};

    if (Object.keys(groupedReqs).length === 0) {
      container.innerHTML = `
        <div class="section-item">
          <label class="section-header">No Requirements Found</label>
          <p>You currently have no active requirements.</p>
        </div>`;
      return;
    }

    // Render sections
    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];
      const reqs = group.requirements;

      let allChecked = true;
      let lastApprover = null;

      if (
        !validationData.offices ||
        typeof validationData.offices !== "object"
      ) {
        allChecked = false;
      } else {
        for (const reqText of reqs) {
          let reqChecked = false;
          let reqApprover = null;

          for (const officeKey in validationData.offices) {
            const checkedArray = validationData.offices[officeKey];
            if (Array.isArray(checkedArray)) {
              for (const item of checkedArray) {
                if (
                  normalizeString(item.requirement) ===
                    normalizeString(reqText) &&
                  item.status === true
                ) {
                  reqChecked = true;
                  if (item.checkedBy) {
                    reqApprover = item.checkedBy;
                  }
                  break;
                }
              }
            }
            if (reqChecked) break;
          }

          if (!reqChecked) {
            allChecked = false;
            break;
          }
          if (reqApprover) {
            // ✅ The last true requirement determines approver
            lastApprover = reqApprover;
          }
        }
      }

      const isDeptGlobal =
        normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal =
        normalizeString(group.category) === "n/a" || group.category === "";

      let headerTitle = "";
      if (!isCategoryGlobal) {
        headerTitle =
          (await getCategoryName(group.category)) || group.category;
        if (/^\d+$/.test(headerTitle)) {
          const labName = await getLabName(group.category);
          if (labName) headerTitle = labName;
        }
      } else if (isCategoryGlobal && isDeptGlobal) {
        headerTitle =
          (await getOfficeName(group.office)) || group.office;
      } else if (isCategoryGlobal && !isDeptGlobal) {
        const officeName =
          (await getOfficeName(group.office)) || group.office;
        const deptName =
          (await getDepartmentName(group.department)) ||
          group.department;
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

      if (allChecked) {
        const approvalDiv = document.createElement("div");
        approvalDiv.classList.add("section-item");
        approvalDiv.innerHTML = `
          <img src="../../Tatak.png" alt="Approved Icon" />
          <label><i>approved by ${lastApprover || "Unknown"}</i></label>`;
        sectionGroupDiv.appendChild(approvalDiv);
      }

      container.appendChild(sectionGroupDiv);
    }
  } catch (err) {
    console.error("Error loading clearance sections:", err);
    container.innerHTML = `
      <div class="section-item">
        <label class="section-header">Error</label>
        <p>Unable to load clearance sections. Please try again later.</p>
      </div>`;
  }
});
