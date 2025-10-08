// ===================== prereq.js =====================

// -------------------- Populate Student Prerequisites --------------------
async function getStudentPrereqs(student, userData) {
  if (!student || !userData || !window.db) return "N/A";

  const db = window.db;
  const office = userData.office;
  const category = String(userData.category || "");
  const department = String(student.department || ""); // use student's actual department

  try {
    // 🔹 Get current semester
    const semesterSnapshot = await db
      .collection("DataTable")
      .doc("Semester")
      .collection("SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (semesterSnapshot.empty)
      return "<span style='color:gray;'>No semester</span>";

    const semesterID = semesterSnapshot.docs[0].id;

    // ============================================================
    // 🔹 CATEGORY-BASED PREREQS (1, 11, 18, 28, 36)
    // ============================================================
    const clubCategories = ["1", "11", "18", "28", "36"];
    if (clubCategories.includes(category)) {
      const studentClubs = Array.isArray(student.clubs) ? student.clubs : [];

      // ✅ Exclude themselves from prereqs
      const filteredClubs = studentClubs.filter(clubID => clubID !== category);

      if (filteredClubs.length === 0) {
        return "<span style='color:gray;'>No clubs</span>";
      }

      const clubsSnapshot = await db
        .collection("DataTable")
        .doc("Clubs")
        .collection("ClubsDocs")
        .get();

      const clubsMap = {};
      clubsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        clubsMap[doc.id] = data.code || doc.id;
      });

      const results = [];
      for (const clubID of filteredClubs) {
        let cleared = false;
        const validationDoc = await db
          .collection("Validation")
          .doc(`1-${clubID}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get();

        if (validationDoc.exists) {
          const requirements = validationDoc.data()?.requirements || [];
          cleared = requirements.length > 0 && requirements.every(r => r.status === true);
        }

        const displayName = clubsMap[clubID] || `Club ${clubID}`;
        results.push(`<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`);
      }

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }
// ============================================================
// 🔹 OFFICE 12 — Combined prereqs with memberships (4-dept & 7-dept)
// ============================================================
if (office === "12") {
  const baseOffices = ["2", "3", "5", "6", "9", "10"]; // removed 7
  const offices = [...baseOffices];
  const results = [];

  // --- Map department code to Firestore doc ID ---
  let departmentID = "";
  if (student.department) {
    const deptSnapshot = await db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
      .where("code", "==", student.department)
      .limit(1)
      .get();

    if (!deptSnapshot.empty) {
      departmentID = deptSnapshot.docs[0].id;
      // Prepend both 4-department and 7-department
      offices.unshift(`4-${departmentID}`, `7-${departmentID}`);
    } else {
      console.warn(`❌ Department code "${student.department}" not found in Firestore`);
    }
  }

  console.log("=== OFFICE 12 PREREQS DEBUG ===");
  console.log("Offices to check (Firestore IDs):", offices);

  // ------------------ Check Office prerequisites ------------------
  for (const off of offices) {
    let cleared = false;

    const validationDoc = await db
      .collection("Validation")
      .doc(off)
      .collection(student.schoolID)
      .doc(semesterID)
      .get();

    if (validationDoc.exists) {
      const requirements = validationDoc.data()?.requirements || [];
      cleared = requirements.length > 0 && requirements.every(r => r.status === true);
    } else {
      console.warn(`❌ Validation doc NOT found for ${off}`);
    }

    // ------------------ Get readable office name ------------------
    let displayName = "";
    if (off.startsWith("4-") || off.startsWith("7-")) {
      const [officeNum, deptNum] = off.split("-");

      const [officeDoc, deptDoc] = await Promise.all([
        db.collection("DataTable").doc("Office").collection("OfficeDocs").doc(officeNum).get(),
        db.collection("DataTable").doc("Department").collection("DepartmentDocs").doc(deptNum).get()
      ]);

      const officeName = officeDoc.exists && officeDoc.data().office
        ? officeDoc.data().office
        : `Office ${officeNum}`;

      const deptName = deptDoc.exists && deptDoc.data().code
        ? deptDoc.data().code
        : deptNum;

      displayName = `${officeName}`;
    } else {
      const officeDoc = await db
        .collection("DataTable")
        .doc("Office")
        .collection("OfficeDocs")
        .doc(off)
        .get();

      displayName = officeDoc.exists
        ? officeDoc.data().office || `Office ${off}`
        : `Office ${off}`;
    }

    results.push(
      `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
    );
  }

  // ------------------ Check Memberships ------------------
  const [membershipSnapshot, clubsSnapshot] = await Promise.all([
    db.collection("Membership").get(),
    db.collection("DataTable").doc("Clubs").collection("ClubsDocs").get()
  ]);

  const clubsMap = {};
  clubsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    clubsMap[doc.id] = data.code || data.name || doc.id;
  });

  for (const categoryDoc of membershipSnapshot.docs) {
    const categoryID = categoryDoc.id;

    if (Number(categoryID) >= 1 && Number(categoryID) <= 6) continue;

    const memberDoc = await db
      .collection("Membership")
      .doc(categoryID)
      .collection("Members")
      .doc(student.schoolID)
      .get();

    if (!memberDoc.exists) continue;

    const possibleValidationIDs = [
      `8-${categoryID}`,
      `13-${categoryID}`,
      `14-${categoryID}`,
      `15-${categoryID}`,
      `16-${categoryID}`
    ];

    const validationDocs = await Promise.all(
      possibleValidationIDs.map(id =>
        db.collection("Validation")
          .doc(id)
          .collection(student.schoolID)
          .doc(semesterID)
          .get()
      )
    );

    const validationDoc = validationDocs.find(doc => doc.exists);
    let cleared = false;
    if (validationDoc) {
      const requirements = validationDoc.data()?.requirements || [];
      cleared = requirements.length > 0 && requirements.every(r => r.status === true);
    }

    const displayName = clubsMap[categoryID] || `Membership ${categoryID}`;
    results.push(
      `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
    );
  }

  console.log("Final results for OFFICE 12:", results.join(", "));
  return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
}




    // ============================================================
    // 🔹 OFFICE 4 — Dean
    // ============================================================
    if (office === "4") {
      const results = [];

      // LAB prerequisite
      const labSnapshot = await db
        .collection("DataTable")
        .doc("Lab")
        .collection("LabDocs")
        .get();
      const labMap = {};
      labSnapshot.docs.forEach(doc => {
        const data = doc.data();
        labMap[doc.id] = data.code || data.lab || doc.id;
      });

      let labCleared = false;
      let labName = "No Lab";
      let isMember = false;

      for (const categoryID of Object.keys(labMap)) {
        const memberDoc = await db
          .collection("Membership")
          .doc(categoryID)
          .collection("Members")
          .doc(student.schoolID)
          .get();

        if (memberDoc.exists) {
          isMember = true;
          labName = labMap[categoryID];

          const validationDoc = await db
            .collection("Validation")
            .doc(`8-${categoryID}`)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          if (validationDoc.exists) {
            const requirements = validationDoc.data()?.requirements || [];
            labCleared = requirements.length > 0 && requirements.every(r => r.status === true);
          }
          break;
        }
      }

      results.push(`<span style="color:${isMember ? (labCleared ? "green" : "red") : "green"}">${labName}</span>`);

      // DEPARTMENT-SPECIFIC COUNCIL + PROGRAM COORDINATOR
      if (department === "2") await handleCouncilAndPC("11", "11-2");
      if (department === "3") await handleCouncilAndPC("28", "11-3");
      if (department === "4") await handleCouncilAndPC("36", null);
      if (department === "5") await handleCouncilAndPC("1", null);

      async function handleCouncilAndPC(clubID, pcID) {
        if ((student.clubs || []).includes(clubID)) {
          let councilCleared = false;
          const councilDoc = await db
            .collection("Validation")
            .doc(`13-${clubID}`)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          if (councilDoc.exists) {
            const requirements = councilDoc.data()?.requirements || [];
            councilCleared = requirements.length > 0 && requirements.every(r => r.status === true);
          }

          const councilData = await db
            .collection("DataTable")
            .doc("Clubs")
            .collection("ClubsDocs")
            .doc(clubID)
            .get();
          const councilName = councilData.exists ? councilData.data().code || "Council" : "Council";

          results.push(`<span style="color:${councilCleared ? "green" : "red"}">${councilName}</span>`);
        }

        if (pcID) {
          let pcCleared = false;
          const pcDoc = await db
            .collection("Validation")
            .doc(pcID)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          if (pcDoc.exists) {
            const requirements = pcDoc.data()?.requirements || [];
            pcCleared = requirements.length > 0 && requirements.every(r => r.status === true);
          }

          results.push(`<span style="color:${pcCleared ? "green" : "red"}">Program Coordinator</span>`);
        }
      }

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

  // ============================================================
// 🔹 OFFICE 6 — Department-specific records (4 & 7 only)
// ============================================================
if (office === "6") {
  const results = [];

  // --- Map department code to Firestore doc ID ---
  let departmentID = "";
  if (student.department) {
    const deptSnapshot = await db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
      .where("code", "==", student.department)
      .limit(1)
      .get();

    if (!deptSnapshot.empty) {
      departmentID = deptSnapshot.docs[0].id;
    } else {
      console.warn(`❌ Department code "${student.department}" not found in Firestore`);
    }
  }

  // Only check 4-department and 7-department
  const offices = [];
  if (departmentID) {
    offices.push(`4-${departmentID}`, `7-${departmentID}`);
  }

  console.log("=== OFFICE 6 PREREQS DEBUG ===");
  console.log("Offices to check (Firestore IDs):", offices);

  // ------------------ Check Office prerequisites ------------------
  for (const off of offices) {
    let cleared = false;

    const validationDoc = await db
      .collection("Validation")
      .doc(off)
      .collection(student.schoolID)
      .doc(semesterID)
      .get();

    if (validationDoc.exists) {
      const requirements = validationDoc.data()?.requirements || [];
      cleared = requirements.length > 0 && requirements.every(r => r.status === true);
    } else {
      console.warn(`❌ Validation doc NOT found for ${off}`);
    }

    // ------------------ Get readable office name ------------------
    const [officeNum, deptNum] = off.split("-");
    const [officeDoc, deptDoc] = await Promise.all([
      db.collection("DataTable").doc("Office").collection("OfficeDocs").doc(officeNum).get(),
      db.collection("DataTable").doc("Department").collection("DepartmentDocs").doc(deptNum).get()
    ]);

    const officeName = officeDoc.exists && officeDoc.data().office
      ? officeDoc.data().office
      : `Office ${officeNum}`;

    const deptName = deptDoc.exists && deptDoc.data().code
      ? deptDoc.data().code
      : deptNum;

    const displayName = `${officeName}`;

    results.push(
      `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
    );
  }

  console.log("Final results for OFFICE 6:", results.join(", "));
  return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
}

    // ============================================================
// 🔹 OFFICE 5 — Student Org prerequisites (UPDATED)
// ============================================================
if (office === "5") {
  // Always include 13-39
  const mainPrereqs = ["13-39"];

  // ✅ Only include 13-40 if student is a member of Membership categoryID 40
  const member40Doc = await db
    .collection("Membership")
    .doc("40")
    .collection("Members")
    .doc(student.schoolID)
    .get();

  if (member40Doc.exists) {
    mainPrereqs.push("13-40");
  }

  // Clubs that need to be checked
  const clubCheckIDs = ["1", "11", "18", "28", "36"];
  const matchedClubs = (student.clubs || []).filter(c => clubCheckIDs.includes(c));

  // Prefix each club with '1-' for Validation lookup
  const matchedClubPrereqs = matchedClubs.map(c => `1-${c}`);

  // Combine main prereqs with club prereqs
  const allPrereqs = [...mainPrereqs, ...matchedClubPrereqs];

  // Get all club display names
  const clubsSnapshot = await db
    .collection("DataTable")
    .doc("Clubs")
    .collection("ClubsDocs")
    .get();

  const clubsMap = {};
  clubsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    clubsMap[doc.id] = data.code || data.name || doc.id;
  });

  const results = [];
  for (const prID of allPrereqs) {
    console.log("Checking prereq:", prID);

    let cleared = false;
    const prereqDoc = await db
      .collection("Validation")
      .doc(prID)
      .collection(student.schoolID)
      .doc(semesterID)
      .get();

    console.log("Prereq doc exists:", prereqDoc.exists);

    if (prereqDoc.exists) {
      const requirements = prereqDoc.data()?.requirements || [];
      console.log("Requirements:", requirements);
      cleared = requirements.length === 0 || requirements.every(r => r.status === true);
    }

    // Display name: remove prefix '13-' or '1-' for clubs
    let displayName = prID;
    if (prID.startsWith("13-")) {
      displayName = clubsMap[prID.replace("13-", "")] || prID;
    } else if (prID.startsWith("1-")) {
      displayName = clubsMap[prID.replace("1-", "")] || prID;
    }

    console.log("Display name:", displayName, "Cleared:", cleared);

    results.push(`<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`);
  }

  return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
}



    // 🔹 Default
    return "N/A";

  } catch (err) {
    console.error("Error fetching prerequisites:", err);
    return "<span style='color:gray;'>Error</span>";
  }
}

// -------------------- Populate Prereq Cells in Table --------------------
async function populatePrerequisites(students, userDataObj) {
  if (!students || !userDataObj) return;

  const cells = document.querySelectorAll(".prereq-cell");

  for (const cell of cells) {
    const studentID = cell.getAttribute("data-studentid");
    const student = students.find((s) => s.schoolID === studentID);
    if (!student) continue;

    try {
      const prereqHTML = await getStudentPrereqs(student, userDataObj);
      cell.innerHTML = prereqHTML;
    } catch (err) {
      console.error("Error loading prerequisites for", studentID, err);
      cell.innerHTML = "<span style='color:gray;'>Error</span>";
    }
  }
}
