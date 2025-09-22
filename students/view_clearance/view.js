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

    // ================= Fetch validation data =================
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const officesData = valDoc?.exists ? valDoc.data().offices || {} : {};

    // ------------------ Filter validation by semester ------------------
    for (const userID in officesData) {
      officesData[userID] = officesData[userID].filter(item => {
        if (!item.semester) return true;
        return item.semester === currentSemesterId || item.semester === currentSemesterName;
      });
    }

    let overallCleared = true;

    // ================= Render office cards =================
    for (const userID in officesData) {
      const validatedArray = officesData[userID];
      const allChecked = validatedArray.length > 0 && validatedArray.every(item => item.status === true);
      if (!allChecked) overallCleared = false;

      // Get most recent approval (if any)
      const lastValidation = validatedArray
        .filter(item => item.status === true && item.checkedBy)
        .sort((a, b) => b.checkedAt - a.checkedAt)[0] || null;

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

      // ================= Resolve office name and image ID =================
      const { officeName, imageId } = await resolveOfficeNameWithImage(userID);

      // ================= Build UI card =================
      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = officeName || userID;
      sectionGroupDiv.appendChild(headerLabel);

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      approvalDiv.innerHTML = allChecked
        ? `<img src="../../logo/${imageId || "default"}.png" 
                alt="Approved Icon" 
                style="width:50px; height:50px;" 
                onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
           <label>
             <i>Approved by: ${String(lastCheckedBy || "Unknown")}</i><br />
             <i>${checkedAt}</i>
             <hr />
           </label>`
        : `<label><i>Not Cleared</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      container.appendChild(sectionGroupDiv);
    }

    // ================= Status Display =================
    statusElement.innerHTML = overallCleared
      ? `<span style="color:green">Completed</span>`
      : `<span style="color:red">Pending</span>`;

    if (Object.keys(officesData).length === 0) {
      container.innerHTML = `<div class="section-item"><label class="section-header">No Offices Found</label><p>You currently have no offices in validation.</p></div>`;
      statusElement.innerHTML = `<span style="color:red">Pending</span>`;
    }

  } catch (err) {
    console.error("Error loading offices:", err);
    container.innerHTML = `<div class="section-item"><label class="section-header">Error</label><p>Unable to load offices. Please try again later.</p></div>`;
    statusElement.innerHTML = `<span style="color:red">Pending</span>`;
  }
});

// ================= Utility Functions =================
async function resolveOfficeNameWithImage(userId) {
  try {
    const snap = await db.collection("Designees")
      .where("userID", "==", String(userId))
      .limit(1)
      .get();

    if (snap.empty) return { officeName: null, imageId: null };
    const designee = snap.docs[0].data();

    let officeName = null;
    let imageId = designee.category || null;

    // Priority: category → department + office → only office → fallback name
    if (imageId) {
      // Use category ID as image
      let catDoc = await db.collection("acadClubTable").doc(imageId).get();
      if (catDoc.exists && catDoc.data().club) officeName = catDoc.data().club;

      catDoc = await db.collection("labTable").doc(imageId).get();
      if (catDoc.exists && catDoc.data().lab) officeName = catDoc.data().lab;

      catDoc = await db.collection("groupTable").doc(imageId).get();
      if (catDoc.exists && catDoc.data().club) officeName = catDoc.data().club;
    }

    // If no category image, fallback to office ID
    if (!officeName && designee.office) {
      const officeDoc = await db.collection("officeTable").doc(designee.office).get();
      if (officeDoc.exists) officeName = officeDoc.data().office;
      imageId = imageId || designee.office; // use office ID as image if no category
    }

    // If no office name, try department
    if (!officeName && designee.department) {
      const depDoc = await db.collection("departmentTable").doc(designee.department).get();
      const depName = depDoc.exists ? depDoc.data().department : "";

      if (designee.office) {
        const officeDoc = await db.collection("officeTable").doc(designee.office).get();
        const offName = officeDoc.exists ? officeDoc.data().office : "";
        officeName = depName && offName ? `${depName} - ${offName}` : depName || offName;
      } else {
        officeName = depName;
      }
    }

    // Fallback to full name
    if (!officeName && (designee.firstName || designee.lastName)) {
      officeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    return { officeName, imageId };

  } catch (err) {
    console.error("Error resolving office name:", err);
    return { officeName: null, imageId: null };
  }
}
