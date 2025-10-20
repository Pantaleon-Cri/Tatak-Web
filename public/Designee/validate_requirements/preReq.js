// ===================== prereq.js (OPTIMIZED) =====================

// -------------------- CACHE for reference data --------------------
const cache = {
  semester: null,
  clubs: null,
  labs: null,
  departments: null,
  offices: null,
  initialized: false
};

// -------------------- Initialize Cache --------------------
async function initializeCache(db) {
  if (cache.initialized) return;

  try {
    const [semesterSnapshot, clubsSnapshot, labSnapshot, deptSnapshot, officeSnapshot] = await Promise.all([
      db.collection("DataTable").doc("Semester").collection("SemesterDocs")
        .where("currentSemester", "==", true).limit(1).get(),
      db.collection("DataTable").doc("Clubs").collection("ClubsDocs").get(),
      db.collection("DataTable").doc("Lab").collection("LabDocs").get(),
      db.collection("DataTable").doc("Department").collection("DepartmentDocs").get(),
      db.collection("DataTable").doc("Office").collection("OfficeDocs").get()
    ]);

    // Semester
    cache.semester = semesterSnapshot.empty ? null : semesterSnapshot.docs[0].id;

    // Clubs map
    cache.clubs = {};
    clubsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      cache.clubs[doc.id] = data.code || data.name || doc.id;
    });

    // Labs map
    cache.labs = {};
    labSnapshot.docs.forEach(doc => {
      const data = doc.data();
      cache.labs[doc.id] = data.lab || data.code || doc.id;
    });

    // Departments map (code -> id and id -> data)
    cache.departments = { byCode: {}, byId: {} };
    deptSnapshot.docs.forEach(doc => {
      const data = doc.data();
      cache.departments.byCode[data.code] = doc.id;
      cache.departments.byId[doc.id] = data;
    });

    // Offices map
    cache.offices = {};
    officeSnapshot.docs.forEach(doc => {
      const data = doc.data();
      cache.offices[doc.id] = data.office || `Office ${doc.id}`;
    });

    cache.initialized = true;
    console.log("✅ Cache initialized successfully");
  } catch (err) {
    console.error("❌ Error initializing cache:", err);
  }
}

// -------------------- Populate Student Prerequisites --------------------
async function getStudentPrereqs(student, userData) {
  if (!student || !userData || !window.db) return "N/A";

  const db = window.db;
  const office = userData.office;
  const category = String(userData.category || "");
  const department = String(student.department || "");

  try {
    // Initialize cache if not done
    await initializeCache(db);

    const semesterID = cache.semester;
    if (!semesterID) return "<span style='color:gray;'>No semester</span>";

    // Skip offices with no prereqs
    const officesWithNoPrereqs = ["8"];
    if (officesWithNoPrereqs.includes(office)) return "N/A";

    // ============================================================
    // 🔹 CATEGORY-BASED PREREQS (1, 11, 18, 28, 36)
    // ============================================================
    const clubCategories = ["1", "11", "18", "28", "36"];
    if (clubCategories.includes(category)) {
      const studentClubs = Array.isArray(student.clubs) ? student.clubs : [];
      const filteredClubs = studentClubs.filter(clubID => clubID !== category);

      if (filteredClubs.length === 0) {
        return "<span style='color:gray;'>No clubs</span>";
      }

      // Parallel validation checks
      const validationPromises = filteredClubs.map(clubID =>
        db.collection("Validation")
          .doc(`1-${clubID}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get()
          .then(doc => ({
            clubID,
            cleared: doc.exists && 
              (doc.data()?.requirements || []).length > 0 &&
              doc.data().requirements.every(r => r.status === true)
          }))
      );

      const validations = await Promise.all(validationPromises);
      const results = validations.map(({ clubID, cleared }) => {
        const displayName = cache.clubs[clubID] || `Club ${clubID}`;
        return `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`;
      });

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

    // ============================================================
    // 🔹 OFFICE 12 — Combined prereqs with memberships
    // ============================================================
    if (office === "12") {
      const baseOffices = ["2", "3", "5", "6", "9", "10"];
      const offices = [...baseOffices];

      // Get department ID from cache
      const departmentID = cache.departments.byCode[student.department];
      if (departmentID) {
        offices.unshift(`4-${departmentID}`, `7-${departmentID}`);
      }

      // Parallel validation checks for offices
      const officeValidations = await Promise.all(
        offices.map(async off => {
          const validationDoc = await db.collection("Validation")
            .doc(off)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          const cleared = validationDoc.exists &&
            (validationDoc.data()?.requirements || []).length > 0 &&
            validationDoc.data().requirements.every(r => r.status === true);

          // Get display name
          let displayName = "";
          if (off.startsWith("4-") || off.startsWith("7-")) {
            const [officeNum] = off.split("-");
            displayName = cache.offices[officeNum] || `Office ${officeNum}`;
          } else {
            displayName = cache.offices[off] || `Office ${off}`;
          }

          return { displayName, cleared };
        })
      );

      const results = officeValidations.map(({ displayName, cleared }) =>
        `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
      );

      // Check Memberships (parallel)
      const membershipSnapshot = await db.collection("Membership").get();
      const membershipChecks = [];

      for (const categoryDoc of membershipSnapshot.docs) {
        const categoryID = categoryDoc.id;
        if (Number(categoryID) >= 1 && Number(categoryID) <= 6) continue;

        membershipChecks.push(
          db.collection("Membership")
            .doc(categoryID)
            .collection("Members")
            .doc(student.schoolID)
            .get()
            .then(async memberDoc => {
              if (!memberDoc.exists) return null;

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
              const cleared = validationDoc &&
                (validationDoc.data()?.requirements || []).length > 0 &&
                validationDoc.data().requirements.every(r => r.status === true);

              const displayName = cache.clubs[categoryID] || `Membership ${categoryID}`;
              return { displayName, cleared };
            })
        );
      }

      const membershipResults = (await Promise.all(membershipChecks))
        .filter(r => r !== null)
        .map(({ displayName, cleared }) =>
          `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
        );

      results.push(...membershipResults);
      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

    // ============================================================
    // 🔹 OFFICE 11 — Show Memberships (CategoryID 1–6 only)
    // ============================================================
    if (office === "11") {
      const categoryIDs = ["1", "2", "3", "4", "5", "6"];

      const membershipChecks = categoryIDs.map(async categoryID => {
        const memberDoc = await db.collection("Membership")
          .doc(categoryID)
          .collection("Members")
          .doc(student.schoolID)
          .get();

        if (!memberDoc.exists) return null;

        const validationDoc = await db.collection("Validation")
          .doc(`8-${categoryID}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get();

        const cleared = validationDoc.exists &&
          (validationDoc.data()?.requirements || []).length > 0 &&
          validationDoc.data().requirements.every(r => r.status === true);

        const displayName = cache.labs[categoryID] || `Lab ${categoryID}`;
        return { displayName, cleared };
      });

      const results = (await Promise.all(membershipChecks))
        .filter(r => r !== null)
        .map(({ displayName, cleared }) =>
          `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
        );

      return results.join(", ") || "<span style='color:gray;'>N/A</span>";
    }

    // ============================================================
    // 🔹 OFFICE 4 — Dean
    // ============================================================
    if (office === "4") {
      const results = [];

      // Program Coordinator
      let pcCleared = false;
      if (student.course) {
        const pcDoc = await db.collection("Validation")
          .doc(`11-${student.course}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get();

        if (pcDoc.exists) {
          const requirements = pcDoc.data()?.requirements || [];
          pcCleared = requirements.length > 0 && requirements.every(r => r.status === true);
        }
      }
      results.push(`<span style="color:${pcCleared ? "green" : "red"}">Program Coordinator</span>`);

      // Department-specific council
      const councilMap = { "2": "11", "3": "28", "4": "36", "5": "1" };
      const clubID = councilMap[department];
      
      if (clubID && (student.clubs || []).includes(clubID)) {
        const councilDoc = await db.collection("Validation")
          .doc(`13-${clubID}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get();

        const councilCleared = councilDoc.exists &&
          (councilDoc.data()?.requirements || []).length > 0 &&
          councilDoc.data().requirements.every(r => r.status === true);

        const councilName = cache.clubs[clubID] || "Council";
        results.push(`<span style="color:${councilCleared ? "green" : "red"}">${councilName}</span>`);
      }

      // Lab prerequisite (parallel check all labs)
      const labChecks = Object.keys(cache.labs).map(async categoryID => {
        const memberDoc = await db.collection("Membership")
          .doc(categoryID)
          .collection("Members")
          .doc(student.schoolID)
          .get();

        if (!memberDoc.exists) return null;

        const validationDoc = await db.collection("Validation")
          .doc(`8-${categoryID}`)
          .collection(student.schoolID)
          .doc(semesterID)
          .get();

        const cleared = validationDoc.exists &&
          (validationDoc.data()?.requirements || []).length > 0 &&
          validationDoc.data().requirements.every(r => r.status === true);

        return { labName: cache.labs[categoryID], cleared };
      });

      const labResults = (await Promise.all(labChecks)).filter(r => r !== null);
      
      if (labResults.length > 0) {
        const { labName, cleared } = labResults[0];
        results.push(`<span style="color:${cleared ? "green" : "red"}">${labName}</span>`);
      } else {
        results.push(`<span style="color:green">No Lab</span>`);
      }

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

    // ============================================================
    // 🔹 OFFICE 6 — Department-specific records (4 & 7 only)
    // ============================================================
    if (office === "6") {
      const departmentID = cache.departments.byCode[student.department];
      if (!departmentID) {
        return "<span style='color:gray;'>No department</span>";
      }

      const offices = [`4-${departmentID}`, `7-${departmentID}`];

      const validations = await Promise.all(
        offices.map(async off => {
          const validationDoc = await db.collection("Validation")
            .doc(off)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          const cleared = validationDoc.exists &&
            (validationDoc.data()?.requirements || []).length > 0 &&
            validationDoc.data().requirements.every(r => r.status === true);

          const [officeNum] = off.split("-");
          const displayName = cache.offices[officeNum] || `Office ${officeNum}`;

          return { displayName, cleared };
        })
      );

      const results = validations.map(({ displayName, cleared }) =>
        `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
      );

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

    // ============================================================
    // 🔹 OFFICE 5 — Student Org prerequisites
    // ============================================================
    if (office === "5") {
      const mainPrereqs = ["13-39"];

      // Check membership 40
      const member40Doc = await db.collection("Membership")
        .doc("40")
        .collection("Members")
        .doc(student.schoolID)
        .get();

      if (member40Doc.exists) {
        mainPrereqs.push("13-40");
      }

      // Add club prereqs
      const clubCheckIDs = ["1", "11", "18", "28", "36"];
      const matchedClubs = (student.clubs || []).filter(c => clubCheckIDs.includes(c));
      const matchedClubPrereqs = matchedClubs.map(c => `1-${c}`);
      const allPrereqs = [...mainPrereqs, ...matchedClubPrereqs];

      // Parallel validation checks
      const validations = await Promise.all(
        allPrereqs.map(async prID => {
          const prereqDoc = await db.collection("Validation")
            .doc(prID)
            .collection(student.schoolID)
            .doc(semesterID)
            .get();

          const cleared = prereqDoc.exists &&
            ((prereqDoc.data()?.requirements || []).length === 0 ||
             prereqDoc.data().requirements.every(r => r.status === true));

          // Get display name
          let displayName = prID;
          if (prID.startsWith("13-")) {
            displayName = cache.clubs[prID.replace("13-", "")] || prID;
          } else if (prID.startsWith("1-")) {
            displayName = cache.clubs[prID.replace("1-", "")] || prID;
          }

          return { displayName, cleared };
        })
      );

      const results = validations.map(({ displayName, cleared }) =>
        `<span style="color:${cleared ? "green" : "red"}">${displayName}</span>`
      );

      return results.join(", ") || "<span style='color:gray;'>No prereqs</span>";
    }

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
  
  // Process all students in parallel
  const updatePromises = Array.from(cells).map(async cell => {
    const studentID = cell.getAttribute("data-studentid");
    const student = students.find(s => s.schoolID === studentID);
    if (!student) return;

    try {
      const prereqHTML = await getStudentPrereqs(student, userDataObj);
      cell.innerHTML = prereqHTML;
    } catch (err) {
      console.error("Error loading prerequisites for", studentID, err);
      cell.innerHTML = "<span style='color:gray;'>Error</span>";
    }
  });

  await Promise.all(updatePromises);
  console.log("✅ All prerequisites loaded");
}

// -------------------- Clear Cache (call when data changes) --------------------
function clearCache() {
  cache.semester = null;
  cache.clubs = null;
  cache.labs = null;
  cache.departments = null;
  cache.offices = null;
  cache.initialized = false;
  console.log("🗑️ Cache cleared");
}