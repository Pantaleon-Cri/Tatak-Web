// ========================== Firebase v8 Initialization ==========================
var firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========================== Cache ==========================
const dataCache = {
  designees: {},
  clubs: {},
  labs: {},
  departments: {},
  offices: {}
};

// ========================== Utilities ==========================
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Batch fetch documents
async function batchFetchDocuments(collection, ids) {
  const results = {};
  const uniqueIds = [...new Set(ids)].filter(id => id);
  
  // Firestore 'in' query limit is 10, so batch them
  const batches = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    batches.push(uniqueIds.slice(i, i + 10));
  }
  
  for (const batch of batches) {
    const snapshot = await db.collection(collection)
      .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    
    snapshot.docs.forEach(doc => {
      results[doc.id] = doc.data();
    });
  }
  
  return results;
}

// Optimized office name resolver with caching
async function resolveOfficeName(designeeID, designeeData = null) {
  try {
    // Use provided designeeData if available
    const designee = designeeData || dataCache.designees[designeeID];
    if (!designee) return designeeID;

    // -------------------- Category: club/lab --------------------
    if (designee.category) {
      const catId = designee.category;

      // If designeeID starts with 8, check lab first
      if (designeeID.startsWith("8")) {
        if (!dataCache.labs[catId]) {
          const labDoc = await db.collection("/DataTable/Lab/LabDocs").doc(catId).get();
          if (labDoc.exists) dataCache.labs[catId] = labDoc.data();
        }
        if (dataCache.labs[catId]?.lab) return dataCache.labs[catId].lab;
      }

      // Check clubs first if not 8
      if (!dataCache.clubs[catId]) {
        const clubDoc = await db.collection("/DataTable/Clubs/ClubsDocs").doc(catId).get();
        if (clubDoc.exists) dataCache.clubs[catId] = clubDoc.data();
      }
      if (dataCache.clubs[catId]?.club) return dataCache.clubs[catId].club;

      // Check labs if club didn't match
      if (!dataCache.labs[catId]) {
        const labDoc = await db.collection("/DataTable/Lab/LabDocs").doc(catId).get();
        if (labDoc.exists) dataCache.labs[catId] = labDoc.data();
      }
      if (dataCache.labs[catId]?.lab) return dataCache.labs[catId].lab;
    }

    // -------------------- Department + Office --------------------
    let depName = "";
    if (designee.department) {
      if (dataCache.departments[designee.department]) {
        depName = dataCache.departments[designee.department].department || dataCache.departments[designee.department].code || "";
      } else {
        const depDoc = await db.collection("/DataTable/Department/DepartmentDocs")
          .doc(designee.department).get();
        if (depDoc.exists) {
          dataCache.departments[designee.department] = depDoc.data();
          depName = depDoc.data().department || depDoc.data().code || "";
        }
      }
    }

    let officeName = "";
    if (designee.office) {
      if (dataCache.offices[designee.office]) {
        officeName = dataCache.offices[designee.office].office || "";
      } else {
        const officeDoc = await db.collection("/DataTable/Office/OfficeDocs")
          .doc(designee.office).get();
        if (officeDoc.exists) {
          dataCache.offices[designee.office] = officeDoc.data();
          officeName = officeDoc.data().office || "";
        }
      }
    }

    if (depName && officeName) return `${depName} - ${officeName}`;
    if (depName) return depName;
    if (officeName) return officeName;

    // -------------------- Fallback to name --------------------
    if (designee.firstName || designee.lastName) {
      return `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    // Final fallback
    return designeeID;

  } catch (err) {
    console.error("Error resolving office name:", err);
    return designeeID;
  }
}


// ========================== Load Current Semester ==========================
async function getCurrentSemester() {
  try {
    const semesterSnapshot = await db.collection("/DataTable/Semester/SemesterDocs")
                                     .where("currentSemester", "==", true)
                                     .limit(1)
                                     .get();
    if (!semesterSnapshot.empty) {
      const semesterData = semesterSnapshot.docs[0].data();
      console.log("Current semester found:", semesterData.semester);
      return { id: semesterSnapshot.docs[0].id, name: semesterData.semester };
    } else {
      console.log("No current semester found in Firestore.");
    }
  } catch (err) {
    console.error("Error fetching semester:", err);
  }
  return null;
}

// ========================== Main (OPTIMIZED) ==========================
document.addEventListener("DOMContentLoaded", async () => {
  const semester = await getCurrentSemester();
  if (!semester) {
    alert("No active semester found.");
    return;
  }
  document.getElementById("semesterDisplay").textContent = semester.name;

  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const container = document.querySelector(".student-main-content");
  container.innerHTML = "<p>Loading requirements...</p>";

  try {
    // ==================== STEP 1: Fetch all designees once ====================
    const designeeSnap = await db.collection("/User/Designees/DesigneesDocs").get();
    if (designeeSnap.empty) {
      container.innerHTML = "<p>No offices found in Validation</p>";
      console.log("No designees found in Firestore.");
      return;
    }

    // Cache all designees
    designeeSnap.docs.forEach(doc => {
      dataCache.designees[doc.id] = doc.data();
    });

    // ==================== STEP 2: Query validation for THIS student ====================
    // Instead of checking each designee one-by-one, use collectionGroup query
    const validationQuery = db.collectionGroup('Validation')
      .where('studentID', '==', studentId)
      .where('semester', '==', semester.id);

    // This won't work directly because Validation is not the subcollection name
    // We need to check all designees, but in PARALLEL

    const designeeIds = designeeSnap.docs.map(doc => doc.id);
    
    // Fetch validation documents in parallel
    const validationPromises = designeeIds.map(async (designeeID) => {
      const semesterDoc = await db
        .collection("Validation")
        .doc(designeeID)
        .collection(studentId)
        .doc(semester.id)
        .get();

      if (!semesterDoc.exists) return null;

      const requirements = semesterDoc.data().requirements || [];
      if (requirements.length === 0) return null;

      return {
        designeeID,
        requirements
      };
    });

    // Wait for all validation checks in parallel
    const validationResults = (await Promise.all(validationPromises))
      .filter(result => result !== null);

    console.log(`Found ${validationResults.length} offices with requirements`);

    if (validationResults.length === 0) {
      container.innerHTML = `<div class="clearance-section-card">
                               <div class="section-header">No Requirements Found</div>
                             </div>`;
      return;
    }

    // ==================== STEP 3: Fetch notes for all relevant designees ====================
    const notesPromises = validationResults.map(async (result) => {
      try {
        const notesSnap = await db
          .collection("RequirementsAndNotes")
          .doc("NotesList")
          .collection(result.designeeID)
          .where("semesterId", "==", semester.id)
          .get();

        const notes = [];
        notesSnap.forEach(doc => {
          const noteData = doc.data();
          if (noteData.addedBy === result.designeeID) {
            notes.push(noteData.note);
          }
        });

        return {
          designeeID: result.designeeID,
          notes
        };
      } catch (e) {
        console.warn(`Error fetching notes for ${result.designeeID}:`, e);
        return {
          designeeID: result.designeeID,
          notes: []
        };
      }
    });

    const notesResults = await Promise.all(notesPromises);
    const notesMap = {};
    notesResults.forEach(result => {
      notesMap[result.designeeID] = result.notes;
    });

    // ==================== STEP 4: Resolve office names in parallel ====================
    const officeNamePromises = validationResults.map(result => 
      resolveOfficeName(result.designeeID, dataCache.designees[result.designeeID])
    );
    const officeNames = await Promise.all(officeNamePromises);

    // ==================== STEP 5: Render all sections ====================
    container.innerHTML = "";

    validationResults.forEach((result, index) => {
      const officeName = officeNames[index];
      const requirements = result.requirements;
      const notes = notesMap[result.designeeID] || [];

      // Build requirements HTML
      let reqHTML = "<ul class='requirements-list'>";
      for (const req of requirements) {
        const safeId = `${result.designeeID}-${req.requirement.replace(/\s+/g, "-").toLowerCase()}`;
        const checked = req.status ? "checked" : "";
        reqHTML += `<li class="requirement-item">
                      <input type="checkbox" id="${safeId}" ${checked} onclick="return false;">
                      <label for="${safeId}">${req.requirement}</label>
                    </li>`;
      }
      reqHTML += "</ul>";

      // Build notes HTML
      let notesHTML = notes.length > 0 
        ? notes.map(note => `<p>${note}</p>`).join('')
        : "<p>No Notes Yet</p>";

      // Render section
      const section = document.createElement("div");
      section.className = "clearance-section-card";
      section.innerHTML = `
        <div class="section-header">${officeName}</div>
        ${reqHTML}
        <div class="notes-section">
          <h4>Notes</h4>
          ${notesHTML}
        </div>
      `;
      container.appendChild(section);
    });

  } catch (err) {
    console.error("Error loading requirements:", err);
    container.innerHTML = "<p>Error loading requirements. Please try again later.</p>";
  }
});